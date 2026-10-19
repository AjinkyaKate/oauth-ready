import type { Evidence, Guide } from "@/lib/schema";

const DIFF: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  medium: "bg-amber-100 text-amber-900 ring-amber-200",
  hard: "bg-rose-100 text-rose-800 ring-rose-200",
};

export function Difficulty({ level, large }: { level: string; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold capitalize ring-1 ${DIFF[level] ?? "bg-slate-100"} ${
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      {level}
    </span>
  );
}

const EV: Record<Evidence["type"], { label: string; cls: string; title: string }> = {
  tested: { label: "Tested", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", title: "We performed this step and saw the result" },
  sourced: { label: "Sourced", cls: "bg-sky-50 text-sky-700 ring-sky-200", title: "Stated by a linked source" },
  uncertain: { label: "Uncertain", cls: "bg-amber-50 text-amber-800 ring-amber-200", title: "Inferred, conflicting or unofficial" },
};

export function EvidenceTag({ ev, guide }: { ev: Evidence; guide: Guide }) {
  const meta = EV[ev.type];
  const srcs = ev.sources.map((id) => guide.sources.find((s) => s.id === id)).filter(Boolean);
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      <span title={ev.note || meta.title} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${meta.cls}`}>
        {meta.label}
      </span>
      {srcs.map((s) => (
        <a key={s!.id} href={`#src-${s!.id}`} title={s!.title} className="text-[11px] text-slate-500 underline-offset-2 hover:underline">
          [{s!.id}]
        </a>
      ))}
      {ev.note && ev.type !== "sourced" && <span className="text-[11px] italic text-slate-500">{ev.note}</span>}
    </span>
  );
}

const OWNER: Record<string, { label: string; cls: string }> = {
  agent: { label: "Agent can do", cls: "bg-violet-100 text-violet-800" },
  you: { label: "You", cls: "bg-slate-800 text-white" },
  provider: { label: "Provider wait", cls: "bg-orange-100 text-orange-800" },
};

export function Owner({ owner }: { owner: string }) {
  const o = OWNER[owner] ?? OWNER.you;
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${o.cls}`}>{o.label}</span>;
}

export function Managed({ managed }: { managed: boolean }) {
  return managed ? (
    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
      Composio-managed app available
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
      Bring your own OAuth app
    </span>
  );
}
