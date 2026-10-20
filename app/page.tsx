import Link from "next/link";
import { allGuides } from "@/lib/guides";
import catalog from "@/data/catalog.json";
import { Difficulty } from "@/components/badges";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";

const ORDER = { easy: 0, medium: 1, hard: 2 } as const;

export default async function Home() {
  const guides = (await allGuides()).sort(
    (a, b) => ORDER[a.verdict.difficulty] - ORDER[b.verdict.difficulty] || a.name.localeCompare(b.name),
  );
  const have = new Set(guides.map((g) => g.slug));
  const pending = (catalog.apps as { name: string; slug: string; managed_oauth: boolean }[]).filter((a) => !have.has(a.slug));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-indigo-700">OAuth Ready · for agent builders on Composio</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Know what it takes to get an OAuth app approved, before you start.
        </h1>
        <p className="mt-3 text-slate-600">
          Every guide answers the same four questions: how hard it is, how long it takes (your work vs. waiting on review),
          what can block you, and which steps an agent can do for you. Each claim is marked{" "}
          <span className="font-medium text-emerald-700">Tested</span>, <span className="font-medium text-sky-700">Sourced</span>{" "}
          or <span className="font-medium text-amber-700">Uncertain</span>.{" "}
          <Link href="/method" className="text-indigo-700 underline-offset-2 hover:underline">
            How we check
          </Link>
        </p>
      </header>

      <SearchBox names={[...guides.map((g) => ({ name: g.name, slug: g.slug, ready: true })), ...pending.map((p) => ({ name: p.name, slug: p.slug, ready: false }))]} />

      <h2 className="mt-10 text-lg font-bold text-slate-900">Guides ({guides.length})</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 group-hover:underline">{g.name}</span>
              <Difficulty level={g.verdict.difficulty} />
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-slate-600">{g.verdict.headline}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">First connection</dt>
                <dd className="font-medium text-slate-900">{g.verdict.first_connection}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Anyone can connect</dt>
                <dd className="font-medium text-slate-900">{g.verdict.public_launch}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded px-1.5 py-0.5 ${g.composio.managed_oauth ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
                {g.composio.managed_oauth ? "Managed app available" : "Bring your own app"}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{g.verdict.approval}</span>
              {g.generated_by === "agent" && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">agent-generated</span>}
            </div>
          </Link>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-bold text-slate-900">Not written yet ({pending.length})</h2>
      <p className="mt-1 text-sm text-slate-600">
        OAuth apps from Composio&apos;s toolkit catalog. Click one to have the agent research it now (about 1 to 3 minutes).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {pending.map((p) => (
          <Link
            key={p.slug}
            href={`/generate?app=${encodeURIComponent(p.name)}`}
            className={`rounded-full border px-3 py-1 text-sm hover:bg-slate-50 ${p.managed_oauth ? "border-indigo-200 text-indigo-900" : "border-slate-300 text-slate-700"}`}
            title={p.managed_oauth ? "Composio-managed app available" : "Bring your own OAuth app"}
          >
            {p.name}
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-500">
        App list and managed-app status from{" "}
        <a className="underline" href="https://docs.composio.dev/toolkits/managed-auth" target="_blank">
          docs.composio.dev/toolkits/managed-auth
        </a>{" "}
        (accessed 2026-10-20). Independent project, not affiliated with Composio.
      </p>
    </main>
  );
}
