"use client";

import { useEffect, useMemo, useState } from "react";
import ReasoningTrace from "../components/ReasoningTrace";

// Add this to globals.css for mobile safe-area support
const CSS_ADDITION = `
@supports (padding: max(0px)) {
  body {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
  
  .pt-safe {
    padding-top: max(0.5rem, env(safe-area-inset-top));
  }
  
  .pb-safe {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
}

/* iOS Tap Highlight */
.tap-highlight-transparent {
  -webkit-tap-highlight-color: transparent;
}

/* Optimize for Android status bar */
@media (prefers-color-scheme: dark) {
  meta[name="theme-color"] {
    content: #0f172a;
  }
}
`;

// Mobile-optimized responsive breakpoints
const BREAKPOINTS = {
  xs: 320,   // iPhone SE, small phones
  sm: 640,   // iPhone 12/13/14, tablets (small)
  md: 768,   // iPad, tablet (medium)
  lg: 1024,  // iPad Pro, desktop
  xl: 1280,  // Large desktop
};

const MOBILE_TABS = ["dashboard", "analyze", "memory", "insights"];
const DESKTOP_TABS = ["dashboard", "incidents", "insights", "memory"];
const DESKTOP_TAB_META = {
  dashboard: {
    label: "Dashboard",
    description: "Command center for live analysis, incident intake, and response quality.",
  },
  incidents: {
    label: "Incidents",
    description: "Focused intake view for triage, recent cases, and quick re-analysis.",
  },
  insights: {
    label: "Insights",
    description: "Operational patterns, trend signals, and the latest analysis snapshot.",
  },
  memory: {
    label: "Memory",
    description: "Top retrieved memories with scoring and relevance context.",
  },
};

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

// ... rest of helper functions remain the same ...

export default function Page() {
  const [mobileTab, setMobileTab] = useState("dashboard");
  const [desktopTab, setDesktopTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [base, setBase] = useState(null);
  const [improved, setImproved] = useState(null);
  const [usedMemories, setUsedMemories] = useState([]);
  const [improvement, setImprovementScore] = useState(0);
  const [memoryCount, setMemoryCount] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [judgeScore, setJudgeScore] = useState(null);
  const [step, setStep] = useState("");
  const [apiHealthStatus, setApiHealthStatus] = useState("up");
  const [apiLatencyMs, setApiLatencyMs] = useState(null);
  const [commandStatus, setCommandStatus] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [reasoningTrace, setReasoningTrace] = useState(null);
  const [analysisMode, setAnalysisMode] = useState("memory_guided");
  const [afterConfidence, setAfterConfidence] = useState(0);
  const [appliedPatterns, setAppliedPatterns] = useState([]);
  const [componentTags, setComponentTags] = useState([]);
  const [activeDesktopMeta, setActiveDesktopMeta] = useState(DESKTOP_TAB_META.dashboard);

  // ... rest of effects and functions remain the same ...

  return (
    <div className="min-h-screen w-full bg-[#0f172a] text-slate-200 overflow-x-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      {/* MOBILE/TABLET/DESKTOP OPTIMIZED HEADER */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-800/90 bg-[#0f172a]/95 backdrop-blur-xl pt-safe">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 lg:px-8">
          {/* Logo Section - Mobile optimized */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full border border-indigo-400/40 bg-slate-950/80 p-0.5 sm:p-1 shadow-lg shadow-indigo-900/30 flex-shrink-0">
              <img
                src="/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg?v=20260415"
                alt="OpsMind AI"
                className="h-full w-full rounded-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-slate-100 leading-tight">OpsMind AI</h1>
              <p className="text-[8px] sm:text-[10px] md:text-xs text-slate-400 leading-tight">AI Intelligence</p>
            </div>
            <div className="block sm:hidden">
              <h1 className="text-xs font-semibold text-slate-100">Ops</h1>
            </div>
          </div>

          {/* Search Bar - Tablet and Desktop only */}
          <div className="hidden md:flex flex-1 px-0 sm:px-2 lg:px-4">
            <button
              onClick={() => setShowPalette(true)}
              className="w-full rounded-lg sm:rounded-xl border border-slate-700/80 bg-slate-900/60 px-2 sm:px-4 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-slate-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-slate-900/80"
            >
              Search... <span className="float-right text-[9px] text-slate-500">⌘K</span>
            </button>
          </div>

          {/* Status Badges - Fully responsive */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-2.5 text-[7px] sm:text-[9px] md:text-xs flex-wrap justify-end">
            <span className="hidden sm:inline rounded-full border border-green-500/40 bg-green-500/15 px-1 sm:px-2 md:px-2.5 py-0.5 md:py-1 text-green-300 whitespace-nowrap">Active</span>
            <span className="rounded-full border border-purple-500/40 bg-purple-500/15 px-1 md:px-2.5 py-0.5 md:py-1 text-purple-200 whitespace-nowrap">M{memoryCount}</span>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-1 md:px-2.5 py-0.5 md:py-1 text-emerald-200 whitespace-nowrap">API ✓</span>
          </div>
        </div>
      </header>

      {/* Command Status */}
      {commandStatus && (
        <div className="mx-auto mt-2 sm:mt-4 max-w-[1600px] px-2 sm:px-4 lg:px-8">
          <div className="animate-fadeIn rounded-lg sm:rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-indigo-200">{commandStatus}</div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="mx-auto max-w-[1600px] px-2 sm:px-4 py-3 sm:py-4 lg:px-8">
        {/* Only show control panel on desktop/tablet */}
        <section className="hidden md:block mt-4">
          <div className="rounded-xl sm:rounded-2xl border border-slate-700/60 bg-gradient-to-r from-indigo-950/50 via-slate-900/70 to-purple-950/40 p-3 sm:p-4 md:p-5 shadow-card backdrop-blur">
            <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-indigo-300">Control</p>
                <h2 className="mt-1 text-base sm:text-lg md:text-xl font-semibold text-slate-100">Incident Analysis</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="rounded-lg sm:rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-indigo-100 transition hover:bg-indigo-500/30">
                  Judge Test
                </button>
                {judgeScore !== null && (
                  <span className="rounded-lg sm:rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-emerald-200">
                    Score {judgeScore}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Navigation - Tabs at bottom */}
      </main>

      {/* MOBILE BOTTOM NAVIGATION - Optimized for safe areas */}
      <div className="fixed bottom-0 left-0 right-0 z-50 w-full border-t border-gray-800 bg-[#0f172a]/98 backdrop-blur-xl pb-safe lg:hidden">
        <div className="flex justify-around items-center min-h-14 sm:min-h-16">
          {[
            { id: "dashboard", label: "Home", icon: "🏠" },
            { id: "analyze", label: "Analyze", icon: "⚡" },
            { id: "memory", label: "Memory", icon: "🧠" },
            { id: "insights", label: "Insights", icon: "📊" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`flex flex-col items-center justify-center flex-1 py-2 sm:py-3 tap-highlight-transparent transition-colors ${
                mobileTab === tab.id ? "text-indigo-400" : "text-slate-300"
              }`}
              onClick={() => setMobileTab(tab.id)}
            >
              <span className="text-base sm:text-lg">{tab.icon}</span>
              <span className="text-[10px] sm:text-xs mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0d1527] pb-16 lg:pb-0">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-3 sm:gap-4 px-2 sm:px-4 py-3 sm:py-5 text-[10px] sm:text-xs text-slate-400 md:grid-cols-3 lg:px-8">
          <div>
            <p className="font-semibold text-slate-200 text-xs">OpsMind AI</p>
            <p className="mt-1 leading-relaxed">DevOps incident intelligence</p>
          </div>
          <div>
            <p className="font-semibold text-slate-200 text-xs">Platform</p>
            <p className="mt-1 leading-relaxed">Memory-backed • Reasoning active</p>
          </div>
          <div>
            <p className="font-semibold text-slate-200 text-xs">© 2026</p>
            <p className="mt-1">Hindsight + Groq</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
