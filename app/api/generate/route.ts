import { agentConfigured, runAgent, slugify, type AgentEvent } from "@/lib/agent";
import { getGuide, saveGenerated } from "@/lib/guides";

export const runtime = "nodejs";
export const maxDuration = 300; // research takes 1-3 minutes

// Streams agent progress as newline-delimited JSON so the page can show each search and fetch live.
export async function POST(req: Request) {
  const { app, force } = (await req.json().catch(() => ({}))) as { app?: string; force?: boolean };
  const query = (app ?? "").trim().slice(0, 120);
  if (!query) return Response.json({ error: "Enter an app name or website." }, { status: 400 });
  if (!agentConfigured())
    return Response.json({ error: "Live generation is not configured (set ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY)." }, { status: 503 });

  const existing = force ? undefined : await getGuide(slugify(query));
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent | { type: "exists"; slug: string }) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (existing) {
          send({ type: "exists", slug: existing.slug });
        } else {
          const guide = await runAgent(query, send);
          if (guide) await saveGenerated(guide);
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Generation failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
