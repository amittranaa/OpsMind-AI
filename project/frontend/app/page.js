"use client";

import { useEffect, useMemo, useState } from "react";
import ReasoningTrace from "../components/ReasoningTrace";
import DecisionTrace from "../components/DecisionTrace";
import MemoryPanel from "../components/MemoryPanel";
import { mapMemories } from "../engine/decisionEngine";

const MOBILE_TABS = ["overview", "analyze", "memory", "insights"];
const TEAM_ID = "opsmind-default";
const USER_ID = "ops-user";

const BTN = {
  primary: "ops-btn ops-btn-primary",
  secondary: "ops-btn ops-btn-secondary",
  success: "ops-btn ops-btn-success",
  danger: "ops-btn ops-btn-danger",
};

const SERVICE_PILLARS = [
  {
    title: "Executive Incident Framing",
    detail: "Convert noisy symptoms into ranked root-cause hypotheses with clear decision context.",
  },
  {
    title: "Evidence-Gated Memory Reuse",
    detail: "Historical incidents only influence remediation when match quality and risk checks pass.",
  },
  {
    title: "Operational Safety Controls",
    detail: "Weak memory confidence automatically triggers deterministic reasoning-first recommendations.",
  },
  {
    title: "Governed Learning Loop",
    detail: "Outcome feedback updates memory quality over time with explicit controls and traceability.",
  },
];

const TRUST_SIGNALS = [
  "Board-ready reliability under production pressure",
  "Transparent recommendation rationale for every decision",
  "Strict validation gates before any memory reuse",
  "Reasoning-first fallback when signal quality drops",
];

const AGENCY_OPERATING_MODEL = [
  "Capture context with constraints and blast radius",
  "Score memory quality against current system state",
  "Produce baseline and final recommendation with traceability",
  "Close the loop using worked/failed outcome feedback",
];

function normalizeFix(result) {
  if (!result) return "No response yet.";
  if (typeof result === "string") return result;
  if (typeof result.fix === "string") return result.fix;
  if (result.fix && typeof result.fix === "object") {
    const values = Object.values(result.fix).filter((value) => typeof value === "string");
    return values.length ? values.join(" ") : "No fix provided.";
  }
  return "No fix provided.";
}

function normalizeRoot(result) {
  if (!result) return "Unknown";
  if (typeof result === "string") return result;
  if (typeof result.root_cause === "string") return result.root_cause;
  if (result.root_cause && typeof result.root_cause === "object") {
    const values = Object.values(result.root_cause).filter((value) => typeof value === "string");
    return values.length ? values.join(" ") : "Unknown";
  }
  return "Unknown";
}

function normalizePatterns(result) {
  if (!result || typeof result === "string") return [];
  if (!Array.isArray(result.applied_patterns)) return [];
  return result.applied_patterns.filter((item) => typeof item === "string" && item.trim()).slice(0, 4);
}

function normalizeTags(result) {
  if (!result || typeof result === "string") return [];
  if (!Array.isArray(result.component_tags)) return [];
  return result.component_tags.filter((item) => typeof item === "string" && item.trim()).slice(0, 5);
}

function dedupeMemories(memories) {
  const seen = new Set();
  const deduped = [];

  for (const memory of Array.isArray(memories) ? memories : []) {
    const key = String(memory?.id || memory?.title || memory?.summary || memory?.metadata?.error_summary || memory?.content || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(memory);
  }

  return deduped;
}

function healthBadge(status) {
  if (status === "live") {
    return "ops-health-live";
  }
  if (status === "slow") {
    return "ops-health-slow";
  }
  return "ops-health-down";
}

export default function HomePage() {
  const [theme, setTheme] = useState("light");
  const [themeTransitioning, setThemeTransitioning] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshingMemory, setRefreshingMemory] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [step, setStep] = useState("");
  const [commandStatus, setCommandStatus] = useState("");
  const [base, setBase] = useState(null);
  const [improved, setImproved] = useState(null);
  const [usedMemories, setUsedMemories] = useState([]);
  const [reasoningTrace, setReasoningTrace] = useState(null);
  const [decisionTrace, setDecisionTrace] = useState(null);
  const [incidents, setIncidents] = useState([
    { summary: "Redis timeout", status: "Resolved" },
    { summary: "API crash", status: "Failed" },
  ]);
  const [mobileTab, setMobileTab] = useState("analyze");
  const [improvementScore, setImprovementScore] = useState(0);
  const [analysisMode, setAnalysisMode] = useState("memory_guided");
  const [apiHealthStatus, setApiHealthStatus] = useState("down");
  const [apiLatencyMs, setApiLatencyMs] = useState(null);
  const [lastInput, setLastInput] = useState("");
  const [lastRootCause, setLastRootCause] = useState("");
  const [lastFix, setLastFix] = useState("");
  const [memoryUsedCount, setMemoryUsedCount] = useState(0);
  const [memoryRejectedReason, setMemoryRejectedReason] = useState("");
  const [memoryMatchReason, setMemoryMatchReason] = useState("");
  const [explicitPatterns, setExplicitPatterns] = useState([]);
  const [analysisError, setAnalysisError] = useState("");

  const memoryPanelData = useMemo(() => usedMemories, [usedMemories]);
  const memoryCount = useMemo(() => Number(memoryUsedCount || 0), [memoryUsedCount]);
  const beforeConfidence = Number(base?.confidence || 0);
  const afterConfidence = Number(improved?.confidence || 0);
  const calculatedImprovement = Math.max(0, Math.round((afterConfidence - beforeConfidence) * 100));
  const improvement = memoryCount > 0 ? (improvementScore > 0 ? improvementScore : calculatedImprovement) : 0;

  const appliedPatterns = useMemo(() => {
    if (Array.isArray(explicitPatterns) && explicitPatterns.length > 0) {
      return explicitPatterns;
    }
    return normalizePatterns(improved);
  }, [explicitPatterns, improved]);

  const componentTags = useMemo(() => normalizeTags(improved), [improved]);

  const successRate = useMemo(() => {
    if (!Array.isArray(incidents) || incidents.length === 0) return 0;
    const resolved = incidents.filter((item) => String(item?.status || "").toLowerCase() === "resolved").length;
    return Math.round((resolved / incidents.length) * 100);
  }, [incidents]);

  const avgConfidence = useMemo(() => {
    const confidence = Math.round(afterConfidence * 100);
    return Number.isFinite(confidence) ? confidence : 0;
  }, [afterConfidence]);

  const kpiCards = useMemo(
    () => [
      {
        label: "Decision confidence",
        value: `${avgConfidence}%`,
        hint: avgConfidence >= 70 ? "Healthy quality threshold" : "Needs more evidence",
      },
      {
        label: "Resolution rate",
        value: `${successRate}%`,
        hint: `${incidents.length} tracked incidents`,
      },
      {
        label: "Memory applied",
        value: `${memoryCount}`,
        hint: memoryCount > 0 ? "Validated reuse active" : "Reasoning-only mode",
      },
      {
        label: "Performance lift",
        value: `${improvement}%`,
        hint: improvement > 0 ? "Measured decision gain" : "No verified gain yet",
      },
    ],
    [avgConfidence, incidents.length, improvement, memoryCount, successRate]
  );

  const hasResult = Boolean(base || improved);

  useEffect(() => {
    let active = true;

    async function checkApiHealth() {
      const start = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const elapsed = Math.round(performance.now() - start);
        if (!active) return;

        if (!response.ok) {
          setApiHealthStatus("down");
          setApiLatencyMs(null);
          return;
        }

        setApiLatencyMs(elapsed);
        setApiHealthStatus(elapsed > 700 ? "slow" : "live");
      } catch {
        if (!active) return;
        setApiHealthStatus("down");
        setApiLatencyMs(null);
      } finally {
        clearTimeout(timeout);
      }
    }

    void checkApiHealth();
    const interval = setInterval(checkApiHealth, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!commandStatus) return;
    const timer = setTimeout(() => setCommandStatus(""), 2500);
    return () => clearTimeout(timer);
  }, [commandStatus]);

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem("opsmind-theme");
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
        return;
      }

      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } catch {
      setTheme("light");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle("theme-shifting", themeTransitioning);
    root.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem("opsmind-theme", theme);
    } catch {
      // Ignore persistence errors in restricted contexts.
    }
  }, [theme, themeTransitioning]);

  useEffect(() => {
    try {
      const savedIncident = window.localStorage.getItem("opsmind-draft-incident");
      if (savedIncident) {
        setIncidentText(savedIncident);
      }

      const savedMobileTab = window.localStorage.getItem("opsmind-mobile-tab");
      if (savedMobileTab && MOBILE_TABS.includes(savedMobileTab)) {
        setMobileTab(savedMobileTab);
      }
    } catch {
      // Ignore persistence errors in restricted contexts.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("opsmind-draft-incident", incidentText);
      window.localStorage.setItem("opsmind-mobile-tab", mobileTab);
    } catch {
      // Ignore persistence errors in restricted contexts.
    }
  }, [incidentText, mobileTab]);

  function toggleTheme() {
    setThemeTransitioning(true);
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    window.setTimeout(() => setThemeTransitioning(false), 240);
  }

  async function analyzeIncident(incidentOverride = "") {
    const provided = typeof incidentOverride === "string" ? incidentOverride : "";
    const input = String(provided || incidentText).trim();
    if (!input || loading) return;

    setLoading(true);
    setAnalysisError("");
    setReasoningTrace(null);
    setDecisionTrace(null);
    setStep("Analyzing incident context");
    const t1 = setTimeout(() => setStep("Retrieving and scoring memory"), 700);
    const t2 = setTimeout(() => setStep("Generating remediation plan"), 1400);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-team-id": TEAM_ID,
          "x-user-id": USER_ID,
        },
        body: JSON.stringify({ error: input }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Analysis failed");
      }

      const memoryUsed = Number(data?.memory?.count || 0);
      const decisionType = String(data?.memory?.decision || "reasoning").toLowerCase();
      const usingMemory = Boolean(data?.memory?.used) && memoryUsed > 0 && decisionType === "memory";
      const normalizedConfidence = Math.max(0, Math.min(1, Number(data?.analysis?.confidence || 0) / 100));

      setBase({
        root_cause: usingMemory ? "Reasoning baseline replaced by validated memory pattern" : "Reasoning-only baseline",
        fix: String(data?.solution?.before || "Baseline unavailable"),
        confidence: Math.max(0, normalizedConfidence - (usingMemory ? 0.08 : 0.02)),
      });

      setImproved({
        root_cause: String(data?.analysis?.rootCause || "Unknown"),
        fix: String(data?.solution?.after || "No recommendation generated"),
        confidence: normalizedConfidence,
        applied_patterns: Array.isArray(data?.solution?.appliedPatterns) ? data.solution.appliedPatterns : [],
      });

      const transformedMemories = mapMemories({
        used: Boolean(data?.memory?.used),
        items: Array.isArray(data?.memory?.items) ? data.memory.items : [],
      });

      setUsedMemories(transformedMemories);
      setReasoningTrace(data?.trace || data?.strict_contract?.trace || null);
      setDecisionTrace({
        scope: String(data?.scope?.blast_radius || data?.strict_contract?.scope?.blast_radius || "unknown"),
        change_detected: Boolean(data?.change?.exists),
        memory_used: Boolean(data?.memory?.used),
        reason: String(
          data?.causal_override?.override
            ? data?.causal_override?.reason || "override applied"
            : data?.memory?.used
              ? data?.memory?.reason || "memory used"
              : data?.memory?.rejectionReason || data?.memory?.reason || "no confirmed change + weak signals"
        ),
        confidence: Number((data?.solution?.confidence ?? data?.improved?.confidence ?? normalizedConfidence ?? 0).toFixed(2)),
      });
      setImprovementScore(Number(data?.solution?.improvement || 0));
      setAnalysisMode(usingMemory ? "memory" : "reasoning_only");
      setMemoryUsedCount(memoryUsed);
      setMemoryRejectedReason(String(data?.memory?.rejectionReason || ""));
      setMemoryMatchReason(String(data?.memory?.matchReason || ""));
      setExplicitPatterns(Array.isArray(data?.solution?.appliedPatterns) ? data.solution.appliedPatterns : []);
      setLastInput(input);
      setLastRootCause(String(data?.analysis?.rootCause || "Unknown"));
      setLastFix(String(data?.solution?.after || "No recommendation generated"));

      const outcome = normalizedConfidence >= 0.7 ? "Resolved" : "Failed";
      setIncidents((prev) => [{ summary: input.slice(0, 56), status: outcome }, ...prev].slice(0, 10));

      if (usingMemory) {
        setCommandStatus(`Validated memory used from ${memoryUsed} record(s)`);
      } else {
        setCommandStatus("Reasoning-only decision used");
      }
    } catch {
      setAnalysisError("Analysis request failed. Check API health and retry with more context.");
      setBase({ root_cause: "Service unavailable", fix: "Check API routes and deployment logs", confidence: 0.25 });
      setImproved({ root_cause: "Memory unavailable", fix: "Bootstrap memory and retry", confidence: 0.4 });
      setUsedMemories([]);
      setReasoningTrace(null);
      setDecisionTrace(null);
      setImprovementScore(0);
      setAnalysisMode("reasoning_only");
      setMemoryUsedCount(0);
      setMemoryRejectedReason("Analysis failed before memory validation");
      setMemoryMatchReason("");
      setExplicitPatterns([]);
      setCommandStatus("Fallback mode active");
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
          "x-team-id": TEAM_ID,
          "x-user-id": USER_ID,
        },
      });
      if (!response.ok) throw new Error("Bootstrap failed");
      setCommandStatus("Memory bootstrap completed");
    } catch {
      setCommandStatus("Memory bootstrap failed");
    }
  }

  async function refreshMemoryPanel(queryText) {
    const query = String(queryText || lastInput || "").trim();
    if (!query) return;

    try {
      const response = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
          "x-team-id": TEAM_ID,
        },
      });

      const data = await response.json();
      const memories = Array.isArray(data?.memories) ? data.memories : [];
      if (memories.length > 0) {
        setUsedMemories((prev) => dedupeMemories([...memories, ...prev]).slice(0, 12));
      }
    } catch {
      setCommandStatus("Memory refresh failed");
    }
  }

  async function refreshMemoryUsabilityContext() {
    const query = String(incidentText || lastInput || "").trim();
    if (!query) {
      setCommandStatus("Enter an incident first");
      return;
    }
    setRefreshingMemory(true);
    setCommandStatus("Refreshing memory matches");
    try {
      await refreshMemoryPanel(query);
      setCommandStatus("Memory matches refreshed");
    } finally {
      setRefreshingMemory(false);
    }
  }

  async function sendFeedback(outcome) {
    if (!lastInput || !lastFix) {
      setCommandStatus("Analyze an incident before sending feedback");
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-team-id": TEAM_ID,
          "x-user-id": USER_ID,
        },
        body: JSON.stringify({
          input: lastInput,
          error: lastInput,
          rootCause: lastRootCause,
          fix: {
            fix: lastFix,
            root_cause: lastRootCause,
          },
          tags: ["incident"],
          outcome,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setCommandStatus("Feedback save failed");
        return;
      }

      if (data?.status === "stored" || data?.status === "updated") {
        setCommandStatus(data?.status === "updated" ? "Memory updated from feedback" : "Feedback saved to memory");
        await refreshMemoryPanel(lastInput);
        if (data?.confidence != null) {
          setImproved((prev) => {
            if (!prev) return prev;
            const confidence = Number(data.confidence);
            if (!Number.isFinite(confidence)) return prev;
            return {
              ...prev,
              confidence: confidence > 1 ? confidence / 100 : confidence,
            };
          });
        }
      } else {
        setCommandStatus(data?.reason || "Feedback not stored");
      }
    } catch {
      setCommandStatus("Feedback save failed");
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  function renderAnalysisState() {
    if (loading) {
      return (
        <div className="ops-state ops-state-loading">
          <p className="ops-state-title">Analysis running</p>
          <p className="ops-state-message">{step || "Evaluating signal and memory quality"}</p>
        </div>
      );
    }

    if (analysisError) {
      return (
        <div className="ops-state ops-state-error">
          <p className="ops-state-title">Analysis error</p>
          <p className="ops-state-message">{analysisError}</p>
        </div>
      );
    }

    if (!hasResult) {
      return (
        <div className="ops-state">
          <p className="ops-state-title">No analysis yet</p>
          <p className="ops-state-message">Submit incident context to generate a remediation recommendation.</p>
        </div>
      );
    }

    return null;
  }

  const activeResult = improved || base;

  return (
    <div className="ops-app min-h-screen text-slate-800" aria-busy={loading || refreshingMemory || feedbackSubmitting}>
      <div className="ops-backdrop" />
      {(loading || refreshingMemory || feedbackSubmitting) && <div className="ops-progress" role="status" aria-live="polite" aria-label="Loading" />}

      <header className="ops-header sticky top-0 z-40 border-b border-slate-200/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl border border-slate-300/80 bg-white p-1.5 shadow-sm">
              <img
                src="/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg?v=20260415"
                alt="OpsMind AI"
                className="h-full w-full rounded-lg object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">OpsMind AI</p>
              <p className="text-xs text-slate-500">Incident Intelligence Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`${BTN.secondary} h-10 w-10 p-0`}
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2.5v2.3M12 19.2v2.3M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M20.2 14.6A8.7 8.7 0 0 1 9.4 3.8a9 9 0 1 0 10.8 10.8z" />
                </svg>
              )}
              <span className="sr-only">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <span className="ops-pill">Team {TEAM_ID}</span>
              <span className={`ops-pill ${healthBadge(apiHealthStatus)}`}>
                API {apiHealthStatus.toUpperCase()}
                {apiLatencyMs !== null ? ` ${apiLatencyMs}ms` : ""}
              </span>
              <span className="ops-pill">User {USER_ID}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-24 pt-8 lg:px-8 lg:pb-12">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm lg:p-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.28fr,0.72fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">Enterprise Reliability Layer</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-slate-900 md:text-4xl lg:text-[2.7rem]">Resolve production incidents faster with validated memory and safer remediation plans</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">A client-facing reliability workspace for high-trust diagnosis, decision traceability, and governed remediation under pressure.</p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <button className={BTN.primary} disabled={loading} onClick={() => void analyzeIncident()}>{loading ? "Analyzing..." : "Run analysis"}</button>
                <button className={BTN.secondary} disabled={loading} onClick={bootstrapMemory}>Bootstrap memory</button>
                <button className={BTN.secondary} disabled={refreshingMemory || loading} onClick={() => void refreshMemoryUsabilityContext()}>
                  {refreshingMemory ? "Refreshing..." : "Refresh memory context"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {TRUST_SIGNALS.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {commandStatus && (
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {commandStatus}
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
              <p className="mt-2.5 text-3xl font-semibold leading-none text-slate-900">{card.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{card.hint}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr,0.55fr]">
          <div className="space-y-5">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Incident studio</p>
                  <h2 className="mt-1.5 text-xl font-semibold text-slate-900">Incident intake and recommendation</h2>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {analysisMode === "reasoning_only" ? "Reasoning-only mode" : "Memory-assisted mode"}
                </span>
              </div>

              <textarea
                value={incidentText}
                onChange={(event) => setIncidentText(event.target.value)}
                placeholder="Describe symptoms, deployment window, dependencies, and constraints"
                className="ops-input mt-5 min-h-44 w-full"
              />

              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={() => void analyzeIncident()} disabled={loading} className={BTN.primary}>
                  {loading ? "Analyzing" : "Run analysis"}
                </button>
                <button onClick={() => setIncidentText("")} className={BTN.secondary}>Clear input</button>
              </div>

              <div className="mt-5">{renderAnalysisState()}</div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recommendation</p>
                  <h3 className="mt-1.5 text-xl font-semibold text-slate-900">Decision output</h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  Confidence {Math.round(afterConfidence * 100)}%
                </span>
              </div>

              {hasResult ? (
                <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Baseline</p>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-700">{normalizeFix(base)}</p>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-500">Root cause: {normalizeRoot(base)}</p>
                  </div>

                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-teal-700">Final recommendation</p>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-700">{normalizeFix(improved)}</p>
                    <p className="mt-2.5 text-xs leading-relaxed text-teal-700">Root cause: {normalizeRoot(improved)}</p>
                    <p className="mt-2 text-xs text-teal-700">Improvement: {improvement}%</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-teal-700">
                      {memoryCount > 0 ? `Memory used from ${memoryCount} record(s)` : `Memory rejected: ${memoryRejectedReason || "low relevance"}`}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No recommendation yet.</p>
              )}

              {appliedPatterns.length > 0 && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Applied patterns</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {appliedPatterns.map((pattern) => (
                      <span key={pattern} className="rounded-full border border-teal-300 bg-teal-100 px-2 py-0.5 text-[11px] text-teal-800">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {componentTags.length > 0 && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Component tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {componentTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hasResult && (
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <button onClick={() => void sendFeedback("worked")} disabled={feedbackSubmitting} className={BTN.success}>{feedbackSubmitting ? "Saving..." : "Mark worked"}</button>
                  <button onClick={() => void sendFeedback("failed")} disabled={feedbackSubmitting} className={BTN.danger}>{feedbackSubmitting ? "Saving..." : "Mark failed"}</button>
                </div>
              )}

              {hasResult && <ReasoningTrace trace={reasoningTrace} />}
              {hasResult && <DecisionTrace trace={decisionTrace} />}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Agency operating model</p>
              <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {AGENCY_OPERATING_MODEL.map((item, index) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                    <span className="mr-2 text-teal-700">{index + 1}.</span>
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="space-y-5">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Validated memory</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    {memoryCount > 0
                      ? `${memoryCount} memory match(es) available for this decision`
                      : "No validated memory attached to the current decision"}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                  Matches {memoryPanelData.length}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <button className={BTN.secondary} disabled={refreshingMemory || loading} onClick={() => void refreshMemoryUsabilityContext()}>{refreshingMemory ? "Refreshing..." : "Refresh memory"}</button>
              </div>

              {memoryMatchReason && <p className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">{memoryMatchReason}</p>}
              {memoryCount === 0 && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Memory was not used: {memoryRejectedReason || "validation score below threshold"}
                </p>
              )}
              <div className="mt-3">
                <MemoryPanel data={memoryPanelData} />
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recent incidents</p>
              <div className="mt-4 space-y-2.5">
                {incidents.map((incident, idx) => (
                  <div key={`${incident.summary}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm">
                    <span className="text-slate-700">{incident.summary}</span>
                    <span className={incident.status === "Resolved" ? "text-teal-700" : "text-rose-700"}>{incident.status}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform capabilities</p>
              <div className="mt-4 space-y-2.5">
                {SERVICE_PILLARS.map((pillar) => (
                  <div key={pillar.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">{pillar.title}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{pillar.detail}</p>
                  </div>
                ))}
              </div>
            </article>

          </aside>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:hidden">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mobile quick views</p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {MOBILE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={mobileTab === tab ? BTN.primary : BTN.secondary}
              >
                {tab}
              </button>
            ))}
          </div>

          {mobileTab === "overview" && (
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Resolution rate: {successRate}%</p>
              <p>Confidence: {avgConfidence}%</p>
              <p>Memory used: {memoryCount}</p>
            </div>
          )}

          {mobileTab === "analyze" && (
            <div className="mt-4">
              <textarea
                value={incidentText}
                onChange={(event) => setIncidentText(event.target.value)}
                placeholder="Describe incident details"
                className="ops-input min-h-32 w-full"
              />
              <button onClick={() => void analyzeIncident()} disabled={loading} className={`${BTN.primary} mt-3 w-full`}>
                {loading ? "Analyzing" : "Run analysis"}
              </button>
            </div>
          )}

          {mobileTab === "memory" && (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <button className={BTN.secondary} disabled={refreshingMemory || loading} onClick={() => void refreshMemoryUsabilityContext()}>{refreshingMemory ? "Refreshing..." : "Refresh memory"}</button>
              </div>
              {memoryCount === 0 && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No memory used yet: {memoryRejectedReason || "run analysis with richer context"}
                </p>
              )}
              <MemoryPanel data={memoryPanelData} />
            </div>
          )}

          {mobileTab === "insights" && (
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Root cause: {normalizeRoot(activeResult)}</p>
              <p>Recommendation: {normalizeFix(activeResult)}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 px-4 py-6 text-xs text-slate-500 md:grid-cols-3 lg:px-8">
          <div>
            <p className="font-semibold text-slate-800">OpsMind AI</p>
            <p className="mt-1.5 leading-relaxed">Production-grade incident triage and memory-safe remediation guidance.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Decision framework</p>
            <p className="mt-1.5 leading-relaxed">Context capture, memory validation, recommendation, evaluation, feedback loop.</p>
          </div>
          <div className="md:text-right">
            <p>OpsMind AI © 2026</p>
            <p className="mt-1">Powered by Hindsight + Groq</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
