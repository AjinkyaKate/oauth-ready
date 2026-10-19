import fs from "node:fs";
import { Guide } from "../lib/schema.ts";
for (const f of fs.readdirSync("data/guides")) {
  const r = Guide.safeParse(JSON.parse(fs.readFileSync("data/guides/" + f, "utf8")));
  const g: any = r.success ? r.data : null;
  const ids = new Set(g?.sources.map((s: any) => s.id));
  const refs = JSON.stringify(g ?? {}).match(/"sources":\["[^\]]*\]/g)?.flatMap((m) => m.match(/s\d+/g) ?? []) ?? [];
  const missing = [...new Set(refs.filter((x) => !ids.has(x)))];
  const em = /[—–]/.test(fs.readFileSync("data/guides/" + f, "utf8"));
  console.log(f, r.success ? "OK" : "INVALID " + JSON.stringify(r.error.issues.slice(0, 3)), g ? `${g.verdict.difficulty} | ${g.verdict.public_launch} | stages ${g.stages.length} | srcs ${g.sources.length}` : "", missing.length ? "MISSING " + missing : "", em ? "EMDASH" : "");
}
