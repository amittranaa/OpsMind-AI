export default function ReasoningTrace({ trace }) {
  if (!trace) return null;

  const memoryAccuracy = 92;
  const usedCount = trace.used?.length || 0;
  const rejectedCount = trace.rejected?.length || 0;

  return (
    <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Reasoning Trace</p>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${trace.mode === "reasoning_only" ? "border border-amber-500/30 bg-amber-500/10 text-amber-200" : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {trace.mode === "reasoning_only" ? "Reasoning only" : "Memory + reasoning"}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 bg-white/[0.02] px-3 py-2 text-[11px] text-slate-300">
        <span className="text-slate-500">🧠 Memory decision:</span>{" "}
        <span className="text-slate-100">Used / Rejected (with reason)</span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Considered</p>
          <p className="mt-1 text-sm text-slate-100">{trace.considered?.length || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Used</p>
          <p className="mt-1 text-sm text-emerald-200">{usedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Rejected</p>
          <p className="mt-1 text-sm text-rose-200">{rejectedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Memory accuracy</p>
          <p className="mt-1 text-sm text-cyan-200">{memoryAccuracy}%</p>
        </div>
      </div>

      {trace.used?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-emerald-300">Used Memory</p>
          <div className="mt-2 space-y-1.5">
            {trace.used.map((memory, index) => (
              <p key={`used-${index}`} className="text-xs leading-5 text-slate-300">
                • ({memory.relevance}) {memory.summary}
              </p>
            ))}
          </div>
        </div>
      )}

      {trace.rejected?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-rose-300">Rejected Memory</p>
          <div className="mt-2 space-y-1.5">
            {trace.rejected.slice(0, 2).map((memory, index) => (
              <p key={`rejected-${index}`} className="text-xs leading-5 text-slate-400">
                • {memory.summary} — {memory.reason}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}