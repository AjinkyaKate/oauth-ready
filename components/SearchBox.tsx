"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Item = { name: string; slug: string; ready: boolean };

export default function SearchBox({ names }: { names: Item[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return names.filter((n) => n.name.toLowerCase().includes(s) || n.slug.includes(s)).slice(0, 6);
  }, [q, names]);

  const go = (e?: React.FormEvent) => {
    e?.preventDefault();
    const exact = matches.find((m) => m.ready && m.name.toLowerCase() === q.trim().toLowerCase());
    if (exact) router.push(`/guides/${exact.slug}`);
    else if (q.trim()) router.push(`/generate?app=${encodeURIComponent(q.trim())}`);
  };

  return (
    <form onSubmit={go} className="relative mt-8 max-w-2xl">
      <label htmlFor="app" className="sr-only">
        App name or website
      </label>
      <div className="flex gap-2">
        <input
          id="app"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Look up an app, or paste its website (e.g. Notion, xero.com)"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          autoComplete="off"
        />
        <button className="shrink-0 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700">
          Get guide
        </button>
      </div>
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((m) => (
            <li key={m.slug}>
              <button
                type="button"
                onClick={() => router.push(m.ready ? `/guides/${m.slug}` : `/generate?app=${encodeURIComponent(m.name)}`)}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span>{m.name}</span>
                <span className={m.ready ? "text-emerald-700" : "text-violet-700"}>{m.ready ? "Guide ready" : "Generate live"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">Not in the list? Press Get guide and an agent will research it live.</p>
    </form>
  );
}
