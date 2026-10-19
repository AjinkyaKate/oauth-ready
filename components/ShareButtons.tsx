"use client";
import { useState } from "react";

export default function ShareButtons({ slug }: { slug: string }) {
  const [msg, setMsg] = useState("");
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 1800);
  };
  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(window.location.href);
          flash("Link copied");
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
      >
        Copy link
      </button>
      <button
        onClick={async () => {
          const md = await (await fetch(`/guides/${slug}/md`)).text();
          await navigator.clipboard.writeText(md);
          flash("Markdown copied");
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
      >
        Copy as Markdown
      </button>
      {msg && <span className="text-sm text-emerald-700">{msg}</span>}
    </div>
  );
}
