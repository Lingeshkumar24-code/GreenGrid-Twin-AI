"use client";

import { FormEvent, useState } from "react";
import { askAssistant } from "@/lib/api";

type Message = { role: "user" | "assistant"; text: string };

const suggestions = ["Which building needs attention first?", "Compare energy and occupancy patterns.", "How can we improve sustainability?"];

export default function AssistantPanel() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "I’m GreenGrid Copilot. Ask me about campus energy, water, occupancy, sustainability, or building status." },
  ]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setInput(""); setError(null); setMessages((current) => [...current, { role: "user", text: message }]); setLoading(true);
    try {
      const response = await askAssistant(message);
      setMessages((current) => [...current, { role: "assistant", text: response.answer }]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The assistant could not answer."); }
    finally { setLoading(false); }
  }

  return <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-[min(380px,calc(100vw-2rem))]">
    {open ? <section className="overflow-hidden rounded-2xl border border-emerald-200/15 bg-[#10211c]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">AI operations copilot</p><p className="mt-0.5 text-xs text-ink-400">Grounded in the current campus snapshot</p></div><button onClick={() => setOpen(false)} className="text-xs text-ink-400 hover:text-white">Minimize</button></header>
      <div className="max-h-64 space-y-3 overflow-y-auto p-4">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-5 ${message.role === "user" ? "bg-emerald-300 text-emerald-950" : "bg-white/[0.07] text-ink-200"}`}>{message.text}</div></div>)}{loading && <div className="text-xs text-emerald-200/70">Analysing campus context…</div>}{error && <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}</div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-ink-300 hover:border-emerald-300/40 hover:text-emerald-200">{suggestion}</button>)}</div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about the campus…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-ink-500 focus:border-emerald-300/50" /><button disabled={!input.trim() || loading} className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">Ask</button></form>
    </section> : <button onClick={() => setOpen(true)} className="ml-auto block rounded-full border border-emerald-300/30 bg-[#10211c]/95 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-xl backdrop-blur-xl hover:border-emerald-200/60">Open AI Copilot</button>}
  </div>;
}
