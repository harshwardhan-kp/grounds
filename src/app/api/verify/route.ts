import { canonicalJson } from "@/lib/serpapi/client";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Archive verification endpoint.
 *
 * Backs the "Verify against archive" feature in GROUNDS. It retrieves the original,
 * third-party search record directly from SerpApi's archive and recalculates its
 * canonical SHA-256 hash against the hash recorded at deposition capture time.
 *
 * This cryptographic verification establishes a rigorous chain of custody, ensuring
 * that any finding is grounded in verifiable evidence rather than uncorroborated local screenshots.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { status: "UNAVAILABLE", message: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json(
      { status: "UNAVAILABLE", message: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  const { searchId, payloadHash } = body as Record<string, unknown>;

  if (
    typeof searchId !== "string" ||
    searchId.trim() === "" ||
    typeof payloadHash !== "string" ||
    payloadHash.trim() === ""
  ) {
    return Response.json(
      {
        status: "UNAVAILABLE",
        message: "Fields 'searchId' and 'payloadHash' must be non-empty strings.",
      },
      { status: 400 }
    );
  }

  const searchIdRegex = /^[a-zA-Z0-9]{8,64}$/;
  if (!searchIdRegex.test(searchId)) {
    return Response.json(
      {
        status: "UNAVAILABLE",
        message: "Field 'searchId' must match the expected format (/^[a-zA-Z0-9]{8,64}$/).",
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return Response.json(
      {
        status: "UNAVAILABLE",
        message: "No SerpApi key configured on this server.",
      },
      { status: 200 }
    );
  }

  try {
    const archiveUrl = `https://serpapi.com/searches/${encodeURIComponent(searchId)}.json?api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(archiveUrl);

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json({
          status: "UNAVAILABLE",
          message:
            "Archived search not found (HTTP 404). SerpApi retains search archives for 31 days; this record may have expired.",
        });
      }

      return Response.json({
        status: "UNAVAILABLE",
        message: `SerpApi archive returned HTTP ${response.status}.`,
      });
    }

    const archiveData: unknown = await response.json();
    const canonical = canonicalJson(archiveData);
    const computedHash = createHash("sha256").update(canonical).digest("hex");
    const publicArchiveUrl = `https://serpapi.com/searches/${searchId}`;

    if (computedHash === payloadHash) {
      return Response.json({
        status: "MATCH",
        message: "Archived payload matches the stored payload hash.",
        computedHash,
        storedHash: payloadHash,
        archiveUrl: publicArchiveUrl,
      });
    }

    return Response.json({
      status: "MISMATCH",
      message:
        "The archived payload differs from the record captured at audit time. Generative answers change, so a mismatch is expected for older observations and is not evidence of tampering.",
      computedHash,
      storedHash: payloadHash,
      archiveUrl: publicArchiveUrl,
    });
  } catch {
    return Response.json({
      status: "UNAVAILABLE",
      message: "Could not reach the SerpApi archive.",
    });
  }
}
