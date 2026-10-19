import { z } from "zod/v4";

// One schema for both curated guides (data/guides/*.json) and agent-generated guides.
// The agent fills it through the `submit_guide` tool, so field descriptions double as instructions.

export const Evidence = z.object({
  type: z.enum(["tested", "sourced", "uncertain"]).describe(
    "tested = performed and observed; sourced = stated by a linked source you read; uncertain = inferred, conflicting or non-official",
  ),
  sources: z.array(z.string()).default([]).describe("ids from the sources list, e.g. ['s1']"),
  note: z.string().optional().describe("why it is uncertain, or what was observed"),
});

export const Step = z.object({
  text: z.string(),
  owner: z.enum(["agent", "you", "provider"]).describe(
    "agent = a research/browser agent could do it; you = needs the developer (sign-in, legal identity, payment, DNS, answering reviewers); provider = waiting on the provider",
  ),
  url: z.string().optional(),
  evidence: Evidence,
});

export const Stage = z.object({
  id: z.enum(["register", "self_test", "limited", "public"]),
  title: z.string(),
  who_can_connect: z.string().describe("e.g. 'Only you', 'Up to 100 test users you list', 'Anyone'"),
  limits: z.string().optional(),
  approval: z.enum(["none", "automatic", "manual review", "partner program"]),
  wait: z.string().describe("e.g. 'none', 'minutes', '3-5 business days', '4-8 weeks'"),
  steps: z.array(Step),
});

export const Guide = z.object({
  slug: z.string().describe("lowercase, hyphenated app name"),
  name: z.string(),
  provider: z.string().optional(),
  website: z.string().optional(),
  developer_portal: z.string().optional(),
  category: z.string().optional(),
  composio: z.object({
    toolkit: z.string().optional(),
    managed_oauth: z.boolean().describe("true only if Composio runs a managed OAuth app for this toolkit"),
    note: z.string().optional(),
  }),
  verdict: z.object({
    difficulty: z.enum(["easy", "medium", "hard"]),
    headline: z.string().describe("one plain sentence a developer can act on"),
    hands_on_time: z.string().describe("SHORT (max 4 words), e.g. '20-45 min': developer's active work to a first working connection"),
    first_connection: z.string().describe("SHORT (max 4 words), e.g. 'Same day': when the developer can connect their OWN account"),
    public_launch: z.string().describe("SHORT (max 4 words), e.g. '4-8 weeks' or 'Usually not possible': when ANY user can connect, including review waits"),
    time_note: z.string().optional().describe("1-2 sentences with the nuance behind the three times (scope tiers, caps, costs)"),
    approval: z.enum(["none", "automatic", "manual review", "partner program"]),
    evidence: Evidence,
  }),
  stages: z.array(Stage),
  requirements: z.array(z.object({ text: z.string(), applies_when: z.string().optional(), evidence: Evidence })),
  blockers: z.array(
    z.object({
      title: z.string(),
      when: z.string(),
      impact: z.string(),
      workaround: z.string().optional(),
      evidence: Evidence,
    }),
  ),
  scopes: z
    .array(z.object({ scope: z.string(), tier: z.string().optional(), note: z.string().optional() }))
    .default([]),
  agent_can: z.array(z.string()),
  you_must: z.array(z.string()),
  redirect_uri: z.string().optional(),
  uncertain: z.array(z.string()).default([]),
  sources: z.array(z.object({ id: z.string(), title: z.string(), url: z.string(), accessed: z.string().optional() })),
  verification_log: z
    .array(z.object({ date: z.string(), method: z.string(), what: z.string(), result: z.string() }))
    .default([]),
  generated_by: z.enum(["curated", "agent"]),
  updated_at: z.string(),
});

export type Guide = z.infer<typeof Guide>;
export type Evidence = z.infer<typeof Evidence>;
export type Stage = z.infer<typeof Stage>;

export const guideJsonSchema = z.toJSONSchema(Guide, { target: "draft-7", io: "input" });
