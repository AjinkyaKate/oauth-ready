import { GoogleGenAI } from "@google/genai";
import { Guide, guideJsonSchema } from "./schema";
import type { AgentEvent } from "./agent";

const slugify = (s: string) =>
  s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.(com|io|dev|ai|co|app|net|org)(\/.*)?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Gemini path for live generation, built for the free tier (no card needed):
//   1. ONE research call with Google Search + URL context. On the free tier only Gemini 2.5 Flash allows
//      search, at about 20 requests a day, so a guide spends exactly one of them.
//   2. ONE structured call (no tools) that turns the notes and sources into a guide. This runs on other
//      models, which have their own daily allowance.
// Gemini cannot combine search tools with a JSON response schema in one call, hence two phases.

const RESEARCH_MODELS = () => [process.env.GEMINI_MODEL || "gemini-2.5-flash"];
const WRITER_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];

export class QuotaError extends Error {}

// Free-tier Gemini answers 503 "high demand" at busy times and 429 when a daily quota is used up.
// Retry busy models with backoff, move to the next model on quota errors, and report a clear error at the end.
async function withRetry<T>(models: string[], call: (model: string) => Promise<T>, emit: (e: AgentEvent) => void): Promise<T> {
  let quotaHit = false;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await call(model);
      } catch (err) {
        const msg = String(err instanceof Error ? err.message : err);
        if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
          quotaHit = true;
          break; // this model's allowance is used up; try the next one
        }
        if (/404|NOT_FOUND|no longer available/i.test(msg)) break;
        if (!/503|UNAVAILABLE|overloaded|high demand|Incomplete JSON|fetch failed/i.test(msg)) throw err;
        emit({ type: "status", text: "Gemini is busy, retrying…" });
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      }
    }
  }
  throw quotaHit
    ? new QuotaError("Today's free research quota is used up. The library guides still work, and live generation resets daily at midnight Pacific time (12:30 PM IST).")
    : new Error("Gemini is overloaded right now. Please try again in a minute.");
}

const ROUNDS = [
  {
    label: "Researching registration, review, limits and policies",
    ask: (app: string) =>
      `Research ${app} for a developer who must register their own OAuth app so their users can connect ${app}.
1. Setup: does ${app} offer OAuth 2.0 for third-party apps? Where exactly is an OAuth app registered (developer portal URL and steps)? Redirect URI rules (would https://backend.composio.dev/api/v3/toolkits/auth/callback be accepted?). Scopes, and any sensitive or restricted ones. What works before review: own account, test users, development mode caps.
2. Going public: review, verification, marketplace approval or partner program required before ANY user can connect. Stated timelines, requirements (privacy policy, verified domain, demo video, security assessment, business verification), user caps or rate limits for unreviewed apps, customer-side admin approval.
3. Costs and policies: API pricing or paid plans needed, terms restricting AI agents, automation or training models on the data, access and refresh token lifetimes, OAuth rule changes announced in 2025 or 2026.`,
  },
];

const RESEARCH_RULES = `You research developer documentation. Use Google Search and read the most relevant official pages (developer docs, app review policies, pricing, changelogs). Prefer the provider's own pages over blogs. Answer as concise bullet notes. After each fact, put the URL it came from in square brackets. Say clearly when something is not stated in official docs, when sources conflict, or when you could not find it. No em-dashes.`;

type Source = { id: string; title: string; url: string; accessed: string };

export async function runGemini(app: string, emit: (e: AgentEvent) => void, rules: string): Promise<Guide | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const today = new Date().toISOString().slice(0, 10);
  emit({ type: "status", text: `Starting research on ${app}` });

  const notes: string[] = [];
  const chunks: { uri: string; title: string }[] = [];

  // One research round today (see ROUNDS); kept as a list so more rounds can be added when quota allows.
  ROUNDS.forEach((r) => emit({ type: "status", text: r.label }));
  const t0 = Date.now();
  await Promise.all(ROUNDS.map(async (round, idx) => {
    const { text, grounding, urlMeta } = await withRetry(RESEARCH_MODELS(), async (model) => {
      const res = await ai.models.generateContent({
        model,
        contents: round.ask(app),
        config: { tools: [{ googleSearch: {} }, { urlContext: {} }], systemInstruction: RESEARCH_RULES, temperature: 0.2 },
      });
      const c = res.candidates?.[0];
      return { text: res.text ?? "", grounding: c?.groundingMetadata, urlMeta: c?.urlContextMetadata };
    }, emit);
    for (const q of grounding?.webSearchQueries ?? []) emit({ type: "search", query: q });
    const found = (grounding?.groundingChunks ?? []).flatMap((g) => (g.web?.uri ? [{ uri: g.web.uri, title: g.web.title ?? "" }] : []));
    if (found.length) emit({ type: "results", items: found.slice(0, 5).map((f) => ({ title: f.title, url: f.title ? `https://${f.title}` : f.uri })) });
    for (const u of urlMeta?.urlMetadata ?? [])
      if (u.retrievedUrl && !u.retrievedUrl.includes("grounding-api-redirect"))
        emit({ type: "fetched", url: u.retrievedUrl, ok: String(u.urlRetrievalStatus).includes("SUCCESS") });
    chunks.push(...found);
    notes[idx] = `## ${round.label}\n${text.trim()}`;
    emit({ type: "note", text: `Finished: ${round.label.replace(/^Checking /, "")} (${Math.round((Date.now() - t0) / 1000)}s)` });
  }));

  emit({ type: "status", text: "Resolving source links" });
  const sources = await resolveSources(chunks, notes.join("\n"), today);

  emit({ type: "status", text: "Writing the guide" });
  const prompt = `${rules.replace(/When done, call submit_guide[\s\S]*$/, "")}

Write the guide for: ${app}

Use ONLY these research notes. Every "sourced" evidence object MUST list at least one id from SOURCES in its "sources" array (match the URL in square brackets after the fact in the notes). If you cannot match a claim to a source id, mark it "uncertain" and say why. If the notes say a timeline is not published, say so instead of estimating, or mark the estimate uncertain.

SOURCES:
${sources.map((s) => `${s.id}: ${s.title} <${s.url}>`).join("\n")}

RESEARCH NOTES:
${notes.join("\n\n")}

Return the guide as JSON. Copy the SOURCES list into "sources" (id, title, url, accessed "${today}"). generated_by "agent", updated_at "${today}".`;

  const schema = { ...(guideJsonSchema as Record<string, unknown>) };
  delete schema.$schema;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await withRetry(
      WRITER_MODELS,
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.2 },
        }),
      emit,
    );
    let raw: unknown;
    try {
      raw = JSON.parse(res.text ?? "");
    } catch {
      emit({ type: "status", text: "Retrying: the model returned invalid JSON" });
      continue;
    }
    const parsed = Guide.safeParse(raw);
    if (parsed.success) {
      const g = parsed.data;
      // Keep only cited ids that exist, and always attach the resolved sources.
      const ids = new Set(sources.map((s) => s.id));
      // A claim marked "sourced" must point at a source we actually collected; otherwise it is uncertain.
      const fix = (e: { type: string; sources: string[]; note?: string }) => {
        e.sources = e.sources.filter((x) => ids.has(x));
        if (e.type === "sourced" && e.sources.length === 0) {
          e.type = "uncertain";
          e.note = e.note || "The agent did not link a source for this claim.";
        }
        if (e.type === "tested") e.type = "uncertain"; // the agent never performs setup steps
      };
      g.stages.forEach((s) => s.steps.forEach((st) => fix(st.evidence)));
      [...g.requirements, ...g.blockers].forEach((r) => fix(r.evidence));
      fix(g.verdict.evidence);
      const guide: Guide = { ...g, slug: slugify(g.slug || g.name || app), sources, generated_by: "agent", updated_at: today };
      emit({ type: "done", guide });
      return guide;
    }
    emit({ type: "status", text: "Fixing fields the schema rejected" });
  }
  emit({ type: "error", message: "The agent did not produce a valid guide. Try again." });
  return undefined;
}

// Grounding chunks point at Google redirect URLs. Resolve them to the real pages so sources are readable,
// and also pick up official URLs the notes cite directly.
async function resolveSources(chunks: { uri: string; title: string }[], notes: string, today: string): Promise<Source[]> {
  const resolved = await Promise.all(
    chunks.slice(0, 30).map(async (c) => {
      try {
        const r = await fetch(c.uri, { redirect: "manual", signal: AbortSignal.timeout(5000) });
        return { url: r.headers.get("location") || c.uri, title: c.title };
      } catch {
        return { url: c.uri, title: c.title };
      }
    }),
  );
  const cited = [...notes.matchAll(/\[(https?:\/\/[^\]\s]+)\]/g)].map((m) => ({ url: m[1], title: "" }));
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const r of [...cited, ...resolved]) {
    const key = r.url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(key) || r.url.includes("grounding-api-redirect")) continue;
    seen.add(key);
    let title = r.title;
    try {
      const u = new URL(r.url);
      title = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 90);
    } catch {}
    out.push({ id: `s${out.length + 1}`, title, url: r.url, accessed: today });
    if (out.length >= 20) break;
  }
  return out;
}
