import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import { Guide, guideJsonSchema } from "./schema";
import catalog from "@/data/catalog.json";
import { runGemini } from "./agent-gemini";

// Live guide generation: Claude researches the provider with server-side web search + web fetch,
// then hands back a structured guide through the `submit_guide` tool. Progress is streamed to the UI.

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "search"; query: string }
  | { type: "results"; items: { title: string; url: string }[] }
  | { type: "fetch"; url: string }
  | { type: "fetched"; url: string; title?: string; ok: boolean }
  | { type: "note"; text: string }
  | { type: "done"; guide: Guide }
  | { type: "error"; message: string };

// Two ways to reach Claude: a direct Anthropic key, or Vercel AI Gateway (API key, or the OIDC token
// Vercel injects into deployments). The gateway speaks the Anthropic Messages API but documents only
// web search as a server tool, so page fetching is turned off there.
const direct = () => Boolean(process.env.ANTHROPIC_API_KEY);
const gatewayToken = () => {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try {
    return getVercelOidcTokenSync(); // per-request token on Vercel; from .env.local after `vercel env pull` locally
  } catch {
    return undefined;
  }
};
const gemini = () => Boolean(process.env.GEMINI_API_KEY);
// Order: Anthropic key, then Gemini free tier, then Vercel AI Gateway.
export const agentConfigured = () => direct() || gemini() || Boolean(gatewayToken());
const model = () => process.env.GUIDE_MODEL || (direct() ? "claude-sonnet-5-5" : "anthropic/claude-sonnet-5.5");
const MANAGED = (catalog.apps as { name: string; managed_oauth: boolean }[])
  .filter((a) => a.managed_oauth)
  .map((a) => a.name)
  .join(", ");

const SYSTEM = `You are an integrations researcher. A developer building an AI agent wants their users to connect an app through Composio. To launch, they may need their OWN OAuth app registered with the provider and approved. Your job: investigate the app and produce a guide that tells them, honestly, how hard this is, how long it takes (hands-on work vs waiting on review), what can block them, and who does what.

How to research:
- Prefer the provider's official developer docs, app review / verification policies, and pricing pages. Use blogs or forums only to fill gaps, and mark those claims "uncertain".
- Find: where to register an OAuth app, redirect URI rules, scopes and any sensitive/restricted tiers, what works before review (own account, test users, dev mode caps), what review/verification/partner approval is needed to let ANY user connect, stated timelines, costs, and policies relevant to AI agents (data use, automation, model training).
- Be efficient: about 4-8 searches and 4-10 page fetches is usually enough. Fetch the key official pages instead of trusting snippets.
- Before each research step, write one short sentence saying what you are checking (it is shown to the developer live).

Evidence discipline (this matters more than completeness):
- "sourced" only if a page you fetched or a search result you read states it; cite its source id.
- "uncertain" for inferences, conflicting sources, unofficial sources, or anything you could not confirm. Say why in the note. List the biggest open questions in "uncertain".
- Never use "tested": you did not perform setup steps.
- If the app does not support OAuth at all (API keys only), say so in the headline, set difficulty by the real effort, and explain the alternative.

Composio facts:
- Composio's OAuth redirect URI to register with the provider: https://backend.composio.dev/api/v3/toolkits/auth/callback
- Composio runs managed OAuth apps (developers can prototype with zero setup, users see "Composio" on consent) for: ${MANAGED}, plus others. For apps not in that list assume no managed app unless Composio docs say otherwise. When a managed app exists, the tip is: build and test on Composio's managed app while your own app goes through review, then switch the auth config.

Writing: plain, concise English a developer can follow without you. No em-dashes. Steps are concrete actions with URLs where possible. Owners: "agent" (research, filling forms, pasting URIs), "you" (sign-in, identity, payment, domain/DNS, legal pages, answering reviewers), "provider" (review waits).

When done, call submit_guide exactly once with the full guide. Use generated_by "agent" and today's date ${new Date().toISOString().slice(0, 10)} for updated_at and accessed dates.`;

const submitTool = {
  name: "submit_guide",
  description: "Submit the finished OAuth setup guide. Call once, at the end.",
  input_schema: guideJsonSchema as Anthropic.Tool.InputSchema,
};

export async function runAgent(app: string, emit: (e: AgentEvent) => void): Promise<Guide | undefined> {
  if (!direct() && gemini()) return runGemini(app, emit, SYSTEM);
  const DIRECT = direct();
  const client = DIRECT ? new Anthropic() : new Anthropic({ apiKey: gatewayToken(), baseURL: "https://ai-gateway.vercel.sh" });
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: DIRECT ? 10 : 14 },
    ...(DIRECT ? [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 12, max_content_tokens: 12000 } as const] : []),
    submitTool,
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Investigate this app and write its OAuth setup guide: ${app}` },
  ];
  emit({ type: "status", text: `Starting research on ${app}` });

  for (let turn = 0; turn < 8; turn++) {
    const stream = client.beta.messages.stream({
      model: model(),
      max_tokens: 16000,
      ...(DIRECT ? { betas: ["web-fetch-2025-09-10"] } : {}),
      system: DIRECT ? SYSTEM : SYSTEM.replace("Fetch the key official pages instead of trusting snippets.", "Search with precise queries (site:developer.example.com style) so results come from official pages."),
      tools,
      messages,
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "text" && block.text.trim()) emit({ type: "note", text: block.text.trim() });
      if (block.type === "server_tool_use") {
        const input = block.input as { query?: string; url?: string };
        if (block.name === "web_search" && input.query) emit({ type: "search", query: input.query });
        if (block.name === "web_fetch" && input.url) emit({ type: "fetch", url: input.url });
      }
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        emit({
          type: "results",
          items: block.content.slice(0, 5).map((r) => ({ title: r.title, url: r.url })),
        });
      }
      if (block.type === "web_fetch_tool_result") {
        const c = block.content as { type: string; url?: string; content?: { title?: string } };
        emit({ type: "fetched", url: c.url ?? "", title: c.content?.title, ok: c.type === "web_fetch_result" });
      }
    });

    const msg = await stream.finalMessage();
    messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });

    if (msg.stop_reason === "pause_turn") continue; // server tools hit their per-turn limit; keep going

    const call = msg.content.find((b) => b.type === "tool_use" && b.name === "submit_guide") as
      | Anthropic.Beta.BetaToolUseBlock
      | undefined;
    if (!call) {
      messages.push({ role: "user", content: "Please call submit_guide now with the complete guide." });
      continue;
    }

    emit({ type: "status", text: "Checking the guide against the schema" });
    const parsed = Guide.safeParse(call.input);
    if (parsed.success) {
      const guide = { ...parsed.data, slug: slugify(parsed.data.slug || parsed.data.name), generated_by: "agent" as const };
      emit({ type: "done", guide });
      return guide;
    }
    const issues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    emit({ type: "status", text: "Fixing a few fields the schema rejected" });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Invalid guide:\n${issues}\nCall submit_guide again with the fixes.` }],
    });
  }
  emit({ type: "error", message: "The agent did not produce a valid guide. Try again." });
  return undefined;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.(com|io|dev|ai|co|app|net|org)(\/.*)?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
