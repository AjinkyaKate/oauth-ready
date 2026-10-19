"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

type Ev =
  | { type: "status" | "note"; text: string }
  | { type: "search"; query: string }
  | { type: "results"; items: { title: string; url: string }[] }
  | { type: "fetch"; url: string }
  | { type: "fetched"; url: string; title?: string; ok: boolean }
  | { type: "done"; guide: { slug: string; name: string } }
  | { type: "exists"; slug: string }
  | { type: "error"; message: string };

function host(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function Live() {
  const params = useSearchParams();
  const router = useRouter();
  const app = params.get("app") ?? "";
  const [events, setEvents] = useState<Ev[]>([]);
  const [state, setState] = useState<"running" | "done" | "error">("running");
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!app || started.current) return;
    started.current = true;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    (async () => {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app, force: params.get("force") === "1" }),
      });
      if (!res.ok || !res.body) {
        const msg = (await res.json().catch(() => ({}))).error ?? "Generation failed";
        setEvents((e) => [...e, { type: "error", message: msg }]);
        setState("error");
        clearInterval(timer);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Ev;
          setEvents((e) => [...e, ev]);
          if (ev.type === "exists") router.replace(`/guides/${ev.slug}`);
          if (ev.type === "done") {
            setState("done");
            setTimeout(() => router.push(`/guides/${ev.guide.slug}`), 1500);
          }
          if (ev.type === "error") setState("error");
        }
      }
      clearInterval(timer);
    })();
    return () => clearInterval(timer);
  }, [app, params, router]);

  if (!app)
    return (
      <p className="text-slate-600">
        No app given. <Link href="/" className="underline">Go back</Link>.
      </p>
    );

  const searches = events.filter((e) => e.type === "search").length;
  const reads = events.filter((e) => e.type === "fetched" && e.ok).length;

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Researching {app}</h1>
      <p className="mt-1 text-sm text-slate-600">
        An agent is reading the provider&apos;s developer docs and policies, then writing a guide. {searches} searches · {reads} pages
        read · {elapsed}s
      </p>
      <ol className="mt-6 space-y-2">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="w-5 shrink-0 text-center">
              {e.type === "search" ? "🔎" : e.type === "fetch" ? "📄" : e.type === "fetched" ? (e.ok ? "✓" : "✗") : e.type === "done" ? "✅" : e.type === "error" ? "⚠️" : e.type === "results" ? "↳" : "•"}
            </span>
            <span className="min-w-0 text-slate-800">
              {e.type === "status" && <b>{e.text}</b>}
              {e.type === "note" && <span className="text-slate-600">{e.text}</span>}
              {e.type === "search" && <>Searching: <i>{e.query}</i></>}
              {e.type === "results" && (
                <span className="text-slate-500">{e.items.map((r) => host(r.url)).slice(0, 4).join(", ")}</span>
              )}
              {e.type === "fetch" && <>Reading <span className="break-all text-sky-700">{e.url}</span></>}
              {e.type === "fetched" && <span className="text-slate-500">{e.ok ? e.title || host(e.url) : `Could not read ${host(e.url)}`}</span>}
              {e.type === "done" && <b>Guide ready. Opening it…</b>}
              {e.type === "exists" && <b>A guide already exists. Opening it…</b>}
              {e.type === "error" && <span className="text-rose-700">{e.message}</span>}
            </span>
          </li>
        ))}
        {state === "running" && (
          <li className="flex gap-3 text-sm text-slate-500">
            <span className="w-5 animate-pulse text-center">●</span> Working…
          </li>
        )}
      </ol>
      {state === "error" && (
        <Link href="/" className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Back to guides
        </Link>
      )}
    </>
  );
}

export default function GeneratePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← All guides
      </Link>
      <div className="mt-6">
        <Suspense>
          <Live />
        </Suspense>
      </div>
    </main>
  );
}
