/**
 * GROUNDS — LLM Gateway.
 *
 * Routes LLM calls through an Anthropic-compatible Messages API endpoint.
 * Configured via environment variables:
 *  - LLM_BASE_URL (e.g. https://api.meta.ai)
 *  - LLM_API_KEY
 *  - LLM_MODEL    (e.g. muse-spark-1.2-contributor[1m])
 *
 * Designed for forensic extraction and cross-examination of generative search answers.
 */

/**
 * Error thrown when an LLM call is attempted without complete environment configuration.
 *
 * Why:
 * GROUNDS must distinguish between missing gateway credentials (which signals the engine
 * to degrade to cached fixture mode) and runtime execution failures (e.g., rate limits,
 * network partitions). Throwing a dedicated error prevents accidental crashes and allows
 * callers to fall back gracefully.
 */
export class LLMUnavailableError extends Error {
  constructor(message = "LLM gateway is unconfigured: LLM_BASE_URL, LLM_API_KEY, or LLM_MODEL is missing.") {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

/**
 * Checks whether all three required LLM environment variables are present.
 *
 * Why:
 * The audit pipeline must determine upfront whether to execute live engine calls
 * or degrade gracefully to offline fixture playback. Inspecting configuration
 * status via this predicate prevents unhandled runtime exceptions in zero-credential
 * or evaluation test environments.
 *
 * @returns True if LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL are all defined and non-empty.
 */
export function isLLMConfigured(): boolean {
  return Boolean(
    process.env.LLM_BASE_URL?.trim() &&
    process.env.LLM_API_KEY?.trim() &&
    process.env.LLM_MODEL?.trim()
  );
}

/**
 * Internal helper to retrieve verified LLM credentials.
 * Throws LLMUnavailableError if any configuration variable is absent.
 */
function getLLMConfig(): { baseUrl: string; apiKey: string; model: string } {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  if (!baseUrl || !apiKey || !model) {
    const missing = [
      !baseUrl && "LLM_BASE_URL",
      !apiKey && "LLM_API_KEY",
      !model && "LLM_MODEL",
    ]
      .filter(Boolean)
      .join(", ");
    throw new LLMUnavailableError(`Missing required LLM environment variables: ${missing}`);
  }

  return { baseUrl, apiKey, model };
}

/**
 * Resolves the target endpoint URL to guarantee the Anthropic Messages API path format:
 * POST {LLM_BASE_URL}/v1/messages
 */
function resolveEndpoint(baseUrl: string): string {
  const sanitized = baseUrl.replace(/\/+$/, "");
  if (sanitized.endsWith("/v1/messages")) {
    return sanitized;
  }
  if (sanitized.endsWith("/v1")) {
    return `${sanitized}/messages`;
  }
  return `${sanitized}/v1/messages`;
}

/**
 * Computes exponential backoff with full jitter to avoid thundering herd against
 * upstream rate-limited endpoints.
 */
function computeBackoffMs(retryCount: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const parsedSeconds = parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(parsedSeconds) && parsedSeconds > 0) {
      return parsedSeconds * 1000;
    }
  }
  const baseDelayMs = 1000;
  const exponential = baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.floor(Math.random() * 500);
  return exponential + jitter;
}

/**
 * Abortable sleep utility for backoff intervals.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Operation aborted"));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(signal?.reason ?? new Error("Operation aborted"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort);
  });
}

/**
 * Extracts and concatenates text blocks from an Anthropic Messages API response payload.
 */
function extractTextContent(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid LLM response: payload is not an object.");
  }

  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.content)) {
    throw new Error("Invalid LLM response: missing or non-array 'content' field.");
  }

  const textBlocks: string[] = [];
  for (const block of record.content) {
    if (
      typeof block === "object" &&
      block !== null &&
      (block as Record<string, unknown>).type === "text" &&
      typeof (block as Record<string, unknown>).text === "string"
    ) {
      textBlocks.push((block as Record<string, unknown>).text as string);
    }
  }

  return textBlocks.join("");
}

/**
 * Strips wrapping markdown code fences (e.g. ```json ... ``` or ``` ... ```) from output text.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();

  // Handle fence wrapping the entire payload
  const fullFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFenceMatch) {
    return fullFenceMatch[1].trim();
  }

  // Handle fence surrounded by introductory/trailing conversational prose
  const embeddedFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (embeddedFenceMatch) {
    return embeddedFenceMatch[1].trim();
  }

  return trimmed;
}

/**
 * Executes a text completion request against an Anthropic-compatible Messages API endpoint.
 *
 * Why:
 * Serves as the fundamental LLM gateway primitive for GROUNDS. Avoids heavy vendor SDKs
 * in favor of standard global fetch, retaining absolute control over HTTP wire contracts.
 * Implements exponential backoff with jitter on HTTP 429 and 5xx errors (up to 3 retries)
 * to survive transient upstream rate spikes and model worker churn, while immediately
 * failing on other 4xx client errors (e.g. 401 Unauthorized, 400 Bad Request) so
 * misconfigurations surface immediately rather than burning budget.
 *
 * @param opts.system Optional system instruction providing behavioral constraints.
 * @param opts.prompt The user prompt or deposition context.
 * @param opts.maxTokens Maximum tokens to generate (defaults to 4096).
 * @param opts.signal Optional AbortSignal for early cancellation.
 * @returns The concatenated text blocks returned by the model.
 * @throws {LLMUnavailableError} If gateway environment variables are missing.
 * @throws {Error} On permanent HTTP errors or after backoff exhaustion.
 */
export async function complete(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const { baseUrl, apiKey, model } = getLLMConfig();
  const endpoint = resolveEndpoint(baseUrl);

  const requestBody: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: Array<{ role: "user"; content: string }>;
  } = {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [{ role: "user", content: opts.prompt }],
  };

  if (opts.system) {
    requestBody.system = opts.system;
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (opts.signal?.aborted) {
      throw opts.signal.reason ?? new Error("Operation aborted.");
    }

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: opts.signal,
      });
    } catch (fetchErr: unknown) {
      if (opts.signal?.aborted) {
        throw opts.signal.reason ?? fetchErr;
      }
      lastError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      if (attempt < maxRetries) {
        const delay = computeBackoffMs(attempt, null);
        await sleep(delay, opts.signal);
        continue;
      }
      throw lastError;
    }

    if (res.ok) {
      let data: unknown;
      try {
        data = await res.json();
      } catch (jsonErr: unknown) {
        throw new Error(
          `Failed to parse response JSON from LLM: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`
        );
      }
      return extractTextContent(data);
    }

    // Client errors other than 429: Never retry
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const errBody = await res.text().catch(() => "");
      throw new Error(
        `LLM API client error (${res.status}): ${errBody || res.statusText}`
      );
    }

    // 429 or 5xx: Retry up to 3 times with jittered exponential backoff
    if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
      const errBody = await res.text().catch(() => "");
      lastError = new Error(
        `LLM API server error (${res.status}): ${errBody || res.statusText}`
      );

      if (attempt < maxRetries) {
        const delay = computeBackoffMs(attempt, res.headers.get("retry-after"));
        await sleep(delay, opts.signal);
        continue;
      }
      throw lastError;
    }

    // Unhandled status codes
    const errBody = await res.text().catch(() => "");
    throw new Error(
      `LLM API unexpected response status (${res.status}): ${errBody || res.statusText}`
    );
  }

  throw lastError ?? new Error("LLM request failed after retries.");
}

/**
 * Executes a structured completion request and parses the result as JSON conforming to T.
 *
 * Why:
 * GROUNDS relies on atomic extraction and formal cross-examination verdicts where downstream
 * evaluation hinges on valid structural records (claims, polarity, citations, verdicts).
 *
 * Why exactly ONE retry on JSON parse failure, and not more:
 *  1. Empirical error correction: Providing the exact JSON parser error and offending snippet
 *     back to the model gives it the precise syntax failure point. If the model cannot format
 *     correct JSON after being given its own syntax error, the failure is almost always due to
 *     underlying schema incompatibility, context overflow, or prompt ambiguity rather than a
 *     transient typo. Further automated retries have near-zero recovery rates.
 *  2. Bounded latency & budget across probe grid: Audits execute across dozens of cells
 *     (locales × probe families). Unbounded or multi-attempt parse retries cause severe latency
 *     tail-risk, cascading queue delays, and token budget exhaustion.
 *  3. Forensic visibility: Fast failure with the first 400 characters of offending text surfaces
 *     unparseable model hallucinations directly for forensic logging or human inspection rather
 *     than concealing systematic instruction-following failures.
 *
 * @param opts.system Optional system prompt.
 * @param opts.prompt Prompt containing the analysis task.
 * @param opts.schemaHint Textual representation or TypeScript description of the required schema.
 * @param opts.maxTokens Optional maximum token length.
 * @param opts.signal Optional AbortSignal.
 * @returns The parsed JSON response as type T.
 * @throws {Error} If parsing fails after the single retry, containing the first 400 chars of offending output.
 */
export async function completeJson<T>(opts: {
  system?: string;
  prompt: string;
  schemaHint: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<T> {
  const jsonDirective =
    `\n\nCRITICAL REQUIREMENT: Return raw JSON ONLY. Do NOT wrap output in markdown code fences, backticks, or any preamble/commentary. The response must be immediately valid under JSON.parse(). Conform strictly to this schema:\n${opts.schemaHint}`;

  const initialPrompt = `${opts.prompt}${jsonDirective}`;

  const firstRaw = await complete({
    system: opts.system,
    prompt: initialPrompt,
    maxTokens: opts.maxTokens,
    signal: opts.signal,
  });

  const firstCleaned = stripCodeFences(firstRaw);

  try {
    return JSON.parse(firstCleaned) as T;
  } catch (firstErr: unknown) {
    const firstErrorMessage =
      firstErr instanceof Error ? firstErr.message : String(firstErr);

    // Single retry with targeted error diagnostic
    const retryPrompt =
      `${initialPrompt}\n\nYour previous response failed JSON parsing with error: "${firstErrorMessage}".\nOffending raw response snippet:\n${firstRaw.slice(0, 400)}\n\nCorrect the syntax error and output strictly valid raw JSON conforming to the schema.`;

    const secondRaw = await complete({
      system: opts.system,
      prompt: retryPrompt,
      maxTokens: opts.maxTokens,
      signal: opts.signal,
    });

    const secondCleaned = stripCodeFences(secondRaw);

    try {
      return JSON.parse(secondCleaned) as T;
    } catch (secondErr: unknown) {
      const secondErrorMessage =
        secondErr instanceof Error ? secondErr.message : String(secondErr);
      const offendingSnippet = secondRaw.slice(0, 400);
      throw new Error(
        `Failed to parse LLM response as JSON after retry: ${secondErrorMessage}. Offending output (first 400 chars):\n${offendingSnippet}`
      );
    }
  }
}
