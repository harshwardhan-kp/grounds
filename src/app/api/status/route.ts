import { isLiveAuditEnabled } from "@/lib/serpapi/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the client what this deployment is allowed to do, before the user acts.
 *
 * Live auditing is off in production so the public demo cannot spend search
 * quota. Without this, the only way to discover that is to type an entity, press
 * depose, and get an error — which reads as a broken app rather than a
 * deliberate limit. The deposition screen calls this on mount so it can present
 * the replay as the primary action and explain the state up front.
 */
export function GET(): Response {
  return Response.json({
    liveAuditEnabled: isLiveAuditEnabled(),
    replayAvailable: true,
  });
}
