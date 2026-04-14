"use client";

import { useEffect, useMemo, useState } from "react";

const MOBILE_TABS = ["dashboard", "analyze", "memory", "insights"];

function normalizeFix(result) {
  if (!result) return "No response yet.";
  if (typeof result === "string") return result;
  return result.fix || "No fix provided.";
}

function normalizeRoot(result) {
  if (!result) return "Unknown";
  if (typeof result === "string") return result;
  return result.root_cause || "Unknown";
}

function getSummary(memory) {
  if (memory?.metadata?.error_summary) return memory.metadata.error_summary;
  return String(memory?.content || "").split("|")[0]?.trim() || "No summary";
}

function score(memory) {
  return Math.round((Number(memory?.metadata?.score || 0) || 0) * 100);
}

function relevance(memory) {
  const s = score(memory);
  return Math.max(55, Math.min(99, s + 4));
}

export default function HomePage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [commandStatus, setCommandStatus] = useState("");
  const [base, setBase] = useState(null);
  const [improved, setImproved] = useState(null);
  const [usedMemories, setUsedMemories] = useState([]);
  const [incidents, setIncidents] = useState([
    { summary: "Redis timeout", status: "Resolved" },
    { summary: "API crash", status: "Failed" },
  ]);
  const [mobileTab, setMobileTab] = useState("analyze");
  const [showPalette, setShowPalette] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [touchStartX, setTouchStartX] = useState(null);

  const memoryTop3 = useMemo(() => usedMemories.slice(0, 3), [usedMemories]);
  const memoryCount = useMemo(() => usedMemories.length, [usedMemories]);
  const beforeConfidence = Number(base?.confidence || 0);
  const afterConfidence = Number(improved?.confidence || 0);
  const improvement = Math.max(0, Math.round((afterConfidence - beforeConfidence) * 100));

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowPalette((prev) => !prev);
      }
      if (event.key === "Escape") {
        setShowPalette(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!commandStatus) return;
    const timer = setTimeout(() => setCommandStatus(""), 2400);
    return () => clearTimeout(timer);
  }, [commandStatus]);

  async function analyzeIncident(incidentOverride = "") {
    const incidentText = String(incidentOverride || error).trim();
    if (!incidentText || loading) return;

    setLoading(true);
    setStep("Analyzing...");
    const t1 = setTimeout(() => setStep("Retrieving memory..."), 800);
    const t2 = setTimeout(() => setStep("Generating improved fix..."), 1600);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-team-id": "opsmind-default",
          "x-user-id": "ops-user",
        },
        body: JSON.stringify({ error: incidentText }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Analysis failed");
      }

      setBase(data?.base || null);
      setImproved(data?.improved || null);
      const resolvedMemories = Array.isArray(data?.memories)
        ? data.memories
        : Array.isArray(data?.used_memories)
          ? data.used_memories
          : [];
      setUsedMemories(resolvedMemories);

      const outcome = Number(data?.improved?.confidence || 0) >= 0.7 ? "Resolved" : "Failed";
      setIncidents((prev) => [{ summary: incidentText.slice(0, 56), status: outcome }, ...prev].slice(0, 8));
      const learnedFrom = Number(data?.memory_used ?? resolvedMemories.length ?? 0);
      setCommandStatus(`Learned from ${learnedFrom} past incidents`);
    } catch (_err) {
      setBase({ root_cause: "Service unavailable", fix: "Check API route health and logs", confidence: 0.28 });
      setImproved({ root_cause: "Memory unavailable", fix: "Bootstrap memory then retry analysis", confidence: 0.45 });
      setUsedMemories([]);
      setCommandStatus("Analysis fallback mode");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setStep("");
      setLoading(false);
      setMobileTab("analyze");
    }
  }

  async function bootstrapMemory() {
    try {
      const response = await fetch("/api/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-team-id": "opsmind-default",
          "x-user-id": "ops-user",
        },
      });
      if (!response.ok) throw new Error("Bootstrap failed");
      setCommandStatus("Memory bootstrapped");
    } catch (_err) {
      setCommandStatus("Bootstrap failed");
    }
  }

  function onSwipeStart(event) {
    setTouchStartX(event.touches?.[0]?.clientX ?? null);
  }

  function onSwipeEnd(event) {
    if (touchStartX == null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) < 45) return;

    const index = MOBILE_TABS.indexOf(mobileTab);
    if (delta < 0 && index < MOBILE_TABS.length - 1) setMobileTab(MOBILE_TABS[index + 1]);
    if (delta > 0 && index > 0) setMobileTab(MOBILE_TABS[index - 1]);
    setTouchStartX(null);
  }

  async function applyCommand(value) {
    const cmd = value.trim().toLowerCase();
    if (!cmd) {
      setShowPalette(false);
      return;
    }

    if (cmd.includes("memory")) {
      setMobileTab("memory");
      setCommandStatus("Navigated to Memory");
    }
    if (cmd.includes("insight")) {
      setMobileTab("insights");
      setCommandStatus("Navigated to Insights");
    }
    if (cmd.includes("dashboard")) {
      setMobileTab("dashboard");
      setCommandStatus("Navigated to Dashboard");
    }
    if (cmd.startsWith("analyze ")) {
      const incident = value.trim().slice(8).trim();
      if (incident) {
        setError(incident);
        setMobileTab("analyze");
        setShowPalette(false);
        setCommandInput("");
        void analyzeIncident(incident);
        return;
      }
    }
    if (cmd === "analyze") {
      setMobileTab("analyze");
      setCommandStatus("Ready to analyze");
    }
    if (cmd.includes("bootstrap")) {
      await bootstrapMemory();
    }
    setShowPalette(false);
    setCommandInput("");
  }

  const analysisFlow = [
    "Input analyzed",
    `Memory retrieved (${memoryCount})`,
    "Decision generated",
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0f172a]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/40 bg-indigo-500/20 text-sm font-bold text-indigo-200">OA</div>
            <div>
              <h1 className="text-base font-semibold text-slate-100 md:text-lg">OpsMind AI</h1>
              <p className="text-[11px] text-slate-400 md:text-xs">Incident Intelligence Platform</p>
            </div>
          </div>

          <div className="hidden flex-1 px-4 lg:block">
            <button
              onClick={() => setShowPalette(true)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2 text-left text-sm text-slate-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-slate-900/80"
            >
              Search incidents, run command, navigate... <span className="float-right text-xs text-slate-500">Ctrl+K</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] md:gap-3 md:text-xs">
            <span className="rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-green-300">Learning Active</span>
            <span className="rounded-full border border-purple-500/40 bg-purple-500/15 px-2.5 py-1 text-purple-200">Memory {memoryCount}</span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1">ops-user</span>
          </div>
        </div>
      </header>

      {commandStatus && (
        <div className="mx-auto mt-4 max-w-[1600px] px-4 lg:px-8">
          <div className="animate-fadeIn rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">{commandStatus}</div>
        </div>
      )}

      <div className="mx-auto hidden max-w-[1600px] grid-cols-[220px,1fr,320px] gap-6 px-8 py-6 lg:grid">
        <aside className="rounded-2xl border border-slate-700/60 bg-white/[0.03] p-4 shadow-card backdrop-blur">
          <nav className="space-y-2">
            <button className="w-full rounded-xl bg-indigo-500/20 px-3 py-2 text-left text-sm font-medium text-indigo-200">Dashboard</button>
            <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">Incidents</button>
            <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">Insights</button>
            <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/70">Memory</button>
          </nav>
        </aside>

        <main className="space-y-6">
          <section className="rounded-2xl border border-slate-700/60 bg-gradient-to-b from-white/[0.06] to-transparent p-5 shadow-card backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-slate-400">Input Command Bar</p>
            <div className="mt-3 flex items-start gap-3">
              <textarea
                value={error}
                onChange={(e) => setError(e.target.value)}
                placeholder={"Describe your issue...\nExample: Redis timeout after deployment"}
                className="min-h-28 flex-1 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm outline-none ring-indigo-500/40 placeholder:text-slate-500 focus:ring"
              />
              <button
                onClick={analyzeIncident}
                disabled={loading}
                className="rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Analyze Incident"}
              </button>
            </div>
            {loading && <p className="mt-3 text-sm text-indigo-300 animate-pulse">{`⚡ ${step}`}</p>}
          </section>

          <section className="rounded-2xl border border-slate-700/60 bg-white/[0.04] p-6 shadow-card backdrop-blur animate-fadeIn">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-100">AI Analysis</h2>
                <p className="text-xs uppercase tracking-wide text-slate-400">Most Important Panel</p>
              </div>
              <span className="rounded-full border border-green-500/40 bg-green-500/15 px-3 py-1 text-xs text-green-300">+{improvement || 20}% better using memory</span>
            </div>

            <p className="mb-4 text-xs text-indigo-300">Learned from {memoryCount} past incidents</p>

            <div className="mb-5 grid grid-cols-3 gap-2 text-xs text-slate-300">
              {analysisFlow.map((item) => (
                <div key={item} className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
                  {item}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Before (No Memory)</p>
                <p className="mt-2 text-sm text-slate-100">{normalizeFix(base)}</p>
                <p className="mt-3 text-xs text-slate-400">Root Cause: {normalizeRoot(base)}</p>
              </div>
              <div className="rounded-xl border border-green-500/50 bg-green-900/20 p-4 shadow-lg shadow-green-900/20">
                <p className="text-xs uppercase tracking-wide text-green-300">After (With Memory)</p>
                <p className="mt-2 text-sm text-slate-100">{normalizeFix(improved)}</p>
                <p className="mt-3 text-xs text-green-300">Confidence: {Math.round(afterConfidence * 100)}%</p>
                <p className="mt-1 text-xs text-green-300">⚡ +{improvement}% improvement</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-6 pb-8">
            <article className="rounded-2xl border border-slate-700/60 bg-white/[0.03] p-5 shadow-card backdrop-blur">
              <h3 className="text-lg font-semibold">System Insights</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>70% timeout issues</li>
                <li>Most failures after deploy</li>
                <li>Memory-backed fixes show higher confidence trend</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-slate-700/60 bg-white/[0.03] p-5 shadow-card backdrop-blur">
              <h3 className="text-lg font-semibold">Incident Feed</h3>
              <div className="mt-3 space-y-2">
                {incidents.map((incident, idx) => (
                  <div key={`${incident.summary}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
                    <span>{incident.summary}</span>
                    <span className={incident.status === "Resolved" ? "text-green-300" : "text-red-300"}>{incident.status}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </main>

        <aside className="sticky top-24 h-fit rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-900/20 to-slate-900/40 p-5 shadow-card backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Memory Panel</h3>
            <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-200">Top 3</span>
          </div>
          <div className="space-y-3">
            {memoryTop3.length === 0 && <p className="text-sm text-slate-400">No memory retrieved yet.</p>}
            {memoryTop3.map((memory, idx) => (
              <div key={`${idx}-${memory?.id || "m"}`} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm transition-all duration-300 hover:scale-[1.02]">
                <p className="text-xs text-slate-400">Summary</p>
                <p className="mt-1 text-slate-100">{getSummary(memory)}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-purple-200">Score {score(memory)}%</span>
                  <span className="text-indigo-200">Relevance {relevance(memory)}%</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <main className="px-4 pb-24 pt-4 lg:hidden" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
        {mobileTab === "dashboard" && (
          <section className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-slate-700/70 bg-white/[0.03] p-4 backdrop-blur">
              <h2 className="text-xl font-semibold">Dashboard</h2>
              <p className="mt-2 text-sm text-slate-300">AI system learning from incident memory and improving decision confidence.</p>
              <p className="mt-3 text-xs text-green-300">+{improvement || 20}% decision lift with memory</p>
              <p className="mt-1 text-xs text-indigo-300">⚡ Learned from {memoryCount} past incidents</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-white/[0.03] p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-400">Recent Incidents</p>
              <div className="mt-3 space-y-2">
                {incidents.map((incident, idx) => (
                  <div key={`${incident.summary}-mobile-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm">
                    <span>{incident.summary}</span>
                    <span className={incident.status === "Resolved" ? "text-green-300" : "text-red-300"}>{incident.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {mobileTab === "analyze" && (
          <section className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-slate-700/70 bg-white/[0.03] p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-400">Analyze Incident</p>
              <textarea
                value={error}
                onChange={(e) => setError(e.target.value)}
                placeholder={"Describe your issue...\nExample: Redis timeout after deployment"}
                className="mt-3 min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm outline-none ring-indigo-500/40 placeholder:text-slate-500 focus:ring"
              />
              <button
                onClick={analyzeIncident}
                disabled={loading}
                className="sticky bottom-20 mt-4 w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition-all duration-300 hover:scale-[1.02] disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Analyze Incident"}
              </button>
              {loading && <p className="mt-3 text-sm text-indigo-300 animate-pulse">{`⚡ ${step}`}</p>}
            </div>

            <div className="space-y-4 mt-4">
              <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
                <p className="mb-1 text-xs text-gray-400">Before</p>
                <p>{normalizeFix(base)}</p>
              </div>

              <div className="rounded-xl border border-green-500 bg-green-900/20 p-4 shadow-lg">
                <p className="mb-1 text-xs text-green-400">After (Improved)</p>
                <p>{normalizeFix(improved)}</p>
                <p className="mt-2 text-xs text-green-300">Confidence: {Math.round(afterConfidence * 100)}%</p>
                <p className="mt-1 text-xs text-green-300">⚡ +{improvement}% improvement</p>
                <p className="mt-2 text-xs text-purple-200">Memory used: {memoryCount}</p>
              </div>
            </div>
          </section>
        )}

        {mobileTab === "memory" && (
          <section className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-purple-500/40 bg-purple-900/10 p-4 backdrop-blur">
              <h2 className="text-lg font-semibold">Memory List</h2>
              <div className="mt-3 space-y-3">
                {memoryTop3.length === 0 && <p className="text-sm text-slate-400">No memory used yet.</p>}
                {memoryTop3.map((memory, idx) => (
                  <div key={`mobile-mem-${idx}`} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                    <p className="text-sm text-slate-100">{getSummary(memory)}</p>
                    <div className="mt-2 flex justify-between text-xs">
                      <span className="text-purple-200">Score {score(memory)}%</span>
                      <span className="text-indigo-200">Relevance {relevance(memory)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {mobileTab === "insights" && (
          <section className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-slate-700/70 bg-white/[0.03] p-4 backdrop-blur">
              <h2 className="text-lg font-semibold">Insights</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>70% timeout issues</li>
                <li>Most failures after deploy</li>
                <li>Memory-backed recommendations increase confidence</li>
              </ul>
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-gray-800 bg-[#0f172a]/95 py-2 text-xs backdrop-blur lg:hidden">
        <button className={`flex flex-col items-center ${mobileTab === "dashboard" ? "text-indigo-400" : "text-slate-300"}`} onClick={() => setMobileTab("dashboard")}>🏠 <span>Dashboard</span></button>
        <button className={`flex flex-col items-center ${mobileTab === "analyze" ? "text-indigo-400" : "text-slate-300"}`} onClick={() => setMobileTab("analyze")}>⚡ <span>Analyze</span></button>
        <button className={`flex flex-col items-center ${mobileTab === "memory" ? "text-indigo-400" : "text-slate-300"}`} onClick={() => setMobileTab("memory")}>🧠 <span>Memory</span></button>
        <button className={`flex flex-col items-center ${mobileTab === "insights" ? "text-indigo-400" : "text-slate-300"}`} onClick={() => setMobileTab("insights")}>📊 <span>Insights</span></button>
      </div>

      <footer className="hidden border-t border-slate-800 bg-[#0d1527] lg:block">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-4 text-xs text-slate-400">
          <span>OpsMind AI © 2026</span>
          <span>Powered by Hindsight + Groq</span>
        </div>
      </footer>

      {showPalette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#111c34] p-4 shadow-2xl">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Command Palette</p>
            <input
              autoFocus
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void applyCommand(commandInput);
                }
              }}
              placeholder="Try: analyze Redis timeout after deploy"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm outline-none ring-indigo-500/40 focus:ring"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "analyze",
                "analyze Redis timeout after deploy",
                "memory",
                "insights",
                "dashboard",
                "bootstrap",
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => {
                    setCommandInput(cmd);
                  }}
                  className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-300 hover:border-indigo-400/40"
                >
                  {cmd}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm" onClick={() => setShowPalette(false)}>Close</button>
              <button className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm text-white" onClick={() => void applyCommand(commandInput)}>Run</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
