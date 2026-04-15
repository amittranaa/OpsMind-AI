"use client";

import { useEffect, useMemo, useState } from "react";

function formatResponse(result) {
  if (!result) {
    return "No result yet.";
  }

  if (typeof result === "string") {
    return result;
  }

  return `Root Cause: ${result.root_cause || "Unknown"}\nFix: ${result.fix || "No fix"}\nSteps: ${result.steps || "-"}\nConfidence: ${result.confidence ?? 0}`;
}

function parseMemoryContent(content) {
  const [errorText = content, fixText = ""] = String(content).split(" | ");
  return { errorText, fixText };
}

function summarizeError(error) {
  const compact = String(error || "").trim().replace(/\s+/g, " ");
  return compact.length > 64 ? `${compact.slice(0, 64)}...` : compact;
}

function buildInsights(incidents, category) {
  if (!incidents.length) {
    return [
      "Common failure types appear here after your first analyzed incident.",
      "Recommendations are generated from recent outcomes and memory confidence.",
    ];
  }

  const failedCount = incidents.filter((item) => item.status === "Failed").length;
  const resolvedCount = incidents.filter((item) => item.status === "Resolved").length;

  return [
    `Common failure type trend: ${String(category || "unknown").toLowerCase()}.`,
    `Recent outcomes: ${resolvedCount} resolved and ${failedCount} failed incidents.`,
    "Recommendation: capture concrete remediation steps for failed incidents to improve retrieval quality.",
  ];
}

export default function HomePage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Describe an issue, run analysis, then send feedback.");
  const [category, setCategory] = useState("UNKNOWN");
  const [baseSolution, setBaseSolution] = useState("No result yet.");
  const [improvedSolution, setImprovedSolution] = useState("No result yet.");
  const [usedMemories, setUsedMemories] = useState([]);
  const [learningMode, setLearningMode] = useState("ACTIVE");
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [incidentFeed, setIncidentFeed] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [teamId, setTeamId] = useState("opsmind-default");
  const [userId, setUserId] = useState("ops-user");

  const insights = useMemo(() => buildInsights(incidentFeed, category), [incidentFeed, category]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 960);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const savedTeam = window.localStorage.getItem("team_id") || "opsmind-default";
    const savedUser = window.localStorage.getItem("user_id") || "ops-user";
    window.localStorage.setItem("team_id", savedTeam);
    window.localStorage.setItem("user_id", savedUser);
    setTeamId(savedTeam);
    setUserId(savedUser);
  }, []);

  function authHeaders() {
    const localTeam = window.localStorage.getItem("team_id") || teamId || "opsmind-default";
    const localUser = window.localStorage.getItem("user_id") || userId || "ops-user";
    return {
      "x-team-id": localTeam,
      "x-user-id": localUser,
    };
  }

  async function handleBootstrap() {
    setStatus("Bootstrapping knowledge base...");

    try {
      const res = await fetch("/api/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Bootstrap failed");
      }

      setStatus(`Knowledge base bootstrapped with ${data.count} baseline incidents for ${data.team_id}.`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }

  async function handleGenerate() {
    if (!error.trim()) {
      setStatus("Please enter an incident first.");
      return;
    }

    setLoading(true);
    setFeedbackEnabled(false);
    setStatus("Analyzing incident with planner, retriever, and executor...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ error: error.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Generate failed");
      }

      setBaseSolution(data.base || {});
      setImprovedSolution(data.improved || {});
      setUsedMemories((data.used_memories || []).slice(0, 3));
      setCategory(String(data.category || "UNKNOWN").toUpperCase());
      setLearningMode(data.learning_mode || "ACTIVE");
      setFeedbackEnabled(true);
      setStatus(`Analysis complete. Retrieved ${data.memory_used || 0} memory entries.`);

      const entry = {
        id: `${Date.now()}-${Math.random()}`,
        summary: summarizeError(error),
        status: "Resolved",
        timestamp: new Date().toLocaleString(),
      };

      setIncidentFeed((prev) => [entry, ...prev].slice(0, 8));
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setBaseSolution("No result yet.");
      setImprovedSolution("No result yet.");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(outcome) {
    if (!feedbackEnabled) {
      return;
    }

    setStatus("Saving feedback to Hindsight...");
    setFeedbackEnabled(false);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          error: error.trim(),
          fix: improvedSolution,
          outcome,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Feedback failed");
      }

      setIncidentFeed((prev) => {
        if (!prev.length) {
          return prev;
        }

        const next = [...prev];
        next[0] = {
          ...next[0],
          status: outcome === "success" ? "Resolved" : "Failed",
        };
        return next;
      });

      setStatus(`Feedback saved: ${outcome}.`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setFeedbackEnabled(true);
    }
  }

  return (
    <main style={styles.page}>
      <div style={{ ...styles.layout, gridTemplateColumns: isMobile ? "1fr" : "minmax(240px, 280px) minmax(0, 1fr)" }}>
        <aside
          style={{
            ...styles.sidebar,
            position: isMobile ? "static" : "sticky",
          }}
        >
          <div style={styles.brandBlock}>
            <img src="/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg?v=20260415" alt="OpsMind AI logo" style={styles.brandLogo} />
            <div>
              <div style={styles.logo}>OpsMind AI</div>
              <p style={styles.logoSub}>AI DevOps Command Center</p>
            </div>
          </div>

          <nav style={styles.menu}>
            <button type="button" style={styles.menuItemActive}>Dashboard</button>
            <button type="button" style={styles.menuItem}>Incidents</button>
            <button type="button" style={styles.menuItem}>Insights</button>
          </nav>
        </aside>

        <section style={styles.content}>
          <header
            style={{
              ...styles.topbar,
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div style={styles.topbarTitleRow}>
              <img src="/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg?v=20260415" alt="OpsMind AI" style={styles.topbarLogo} />
              <div>
                <h1 style={styles.title}>Incident Intelligence</h1>
                <p style={styles.topbarSub}>Incident workflow that learns across teams and deployments.</p>
              </div>
            </div>
            <div style={styles.topbarActions}>
              <span style={styles.learningBadge}>Learning Mode: {learningMode}</span>
              <button type="button" style={{ ...styles.seedButton, width: isMobile ? "100%" : "auto" }} onClick={handleBootstrap}>
                Bootstrap Knowledge Base
              </button>
            </div>
          </header>

          <section style={styles.inputCard} className="hoverLift">
            <textarea
              style={styles.textarea}
              placeholder="Describe your issue or paste logs..."
              value={error}
              onChange={(e) => setError(e.target.value)}
            />
            <button type="button" style={styles.primaryButton} onClick={handleGenerate} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Incident"}
            </button>
          </section>

          <section style={styles.twoColGrid}>
            <article style={styles.card} className="hoverLift">
              <div style={styles.cardHeader}>Recent Incidents</div>
              <div style={styles.stack}>
                {incidentFeed.length ? (
                  incidentFeed.map((incident) => (
                    <div key={incident.id} style={styles.feedRow}>
                      <div style={styles.feedSummary}>{incident.summary}</div>
                      <div style={styles.feedMetaRow}>
                        <span style={incident.status === "Resolved" ? styles.statusResolved : styles.statusFailed}>
                          {incident.status}
                        </span>
                        <span style={styles.feedTime}>{incident.timestamp}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={styles.emptyText}>No incidents yet.</p>
                )}
              </div>
            </article>

            <article style={styles.card} className="hoverLift">
              <div style={styles.cardHeader}>Hindsight Memory</div>
              <div style={styles.stack}>
                {usedMemories.length ? (
                  usedMemories.slice(0, 3).map((memory, idx) => {
                    const parsed = parseMemoryContent(memory.content);
                    return (
                      <div key={`${memory.content}-${idx}`} style={styles.memoryRow}>
                        <div style={styles.memoryTitle}>{parsed.errorText}</div>
                        <div style={styles.memoryFix}>{parsed.fixText || "Fix unavailable"}</div>
                        <span style={styles.scoreBadge}>score {(Number(memory?.metadata?.score || 0)).toFixed(2)}</span>
                      </div>
                    );
                  })
                ) : (
                  <p style={styles.emptyText}>No memory matches yet.</p>
                )}
              </div>
            </article>
          </section>

          <section style={styles.comparisonPanel} className="hoverLift">
            <div style={styles.cardHeader}>Before vs After</div>
            <div style={styles.compareGrid}>
              <article style={styles.compareCard}>
                <div style={styles.compareTitle}>Before (No Memory)</div>
                <pre style={styles.responseText}>{formatResponse(baseSolution)}</pre>
              </article>
              <article style={styles.compareCardImproved}>
                <div style={styles.compareTitle}>After (With Memory)</div>
                <pre style={styles.responseText}>{formatResponse(improvedSolution)}</pre>
              </article>
            </div>
          </section>

          <section style={styles.card} className="hoverLift">
            <div style={styles.cardHeader}>System Insights</div>
            <ul style={styles.insightList}>
              {insights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section style={{ ...styles.actionRow, flexDirection: isMobile ? "column" : "row" }}>
            <button
              type="button"
              style={{ ...styles.successButton, width: isMobile ? "100%" : "auto" }}
              onClick={() => sendFeedback("success")}
              disabled={!feedbackEnabled}
            >
              ✅ Worked
            </button>
            <button
              type="button"
              style={{ ...styles.failButton, width: isMobile ? "100%" : "auto" }}
              onClick={() => sendFeedback("failed")}
              disabled={!feedbackEnabled}
            >
              ❌ Failed
            </button>
          </section>

          <p style={styles.statusText}>{status}</p>
          <p style={styles.metaText}>Team: {teamId} | User: {userId}</p>
        </section>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hoverLift {
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .hoverLift:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.12);
        }
      `}</style>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "linear-gradient(140deg, #eef2ff 0%, #f8fafc 42%, #e2e8f0 100%)",
    color: "#0f172a",
    fontFamily: "Space Grotesk, Manrope, ui-sans-serif, system-ui",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: 20,
    maxWidth: 1400,
    margin: "0 auto",
  },
  sidebar: {
    background: "#111827",
    borderRadius: 18,
    padding: 20,
    color: "#e5e7eb",
    boxShadow: "0 14px 28px rgba(15,23,42,0.25)",
    height: "fit-content",
    position: "sticky",
    top: 20,
  },
  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    paddingBottom: 18,
    marginBottom: 18,
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  },
  brandLogo: {
    width: 92,
    height: "auto",
    display: "block",
    flexShrink: 0,
  },
  logo: {
    fontSize: "1.35rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  logoSub: {
    margin: "8px 0 0",
    color: "#9ca3af",
    fontSize: "0.88rem",
  },
  menu: {
    marginTop: 24,
    display: "grid",
    gap: 8,
  },
  menuItem: {
    textAlign: "left",
    background: "transparent",
    color: "#cbd5e1",
    border: "1px solid transparent",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 600,
  },
  menuItemActive: {
    textAlign: "left",
    background: "rgba(99,102,241,0.24)",
    color: "#e0e7ff",
    border: "1px solid rgba(99,102,241,0.45)",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 700,
  },
  content: {
    display: "grid",
    gap: 20,
  },
  topbar: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 10px 20px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.2)",
    padding: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    animation: "fadeSlideIn 340ms ease both",
  },
  topbarTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  topbarLogo: {
    width: 44,
    height: 44,
    display: "block",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "clamp(1.45rem, 2.3vw, 1.9rem)",
    letterSpacing: "-0.02em",
  },
  topbarSub: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "0.95rem",
    lineHeight: 1.4,
  },
  learningBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.15)",
    color: "#15803d",
    fontWeight: 700,
    border: "1px solid rgba(34,197,94,0.3)",
  },
  topbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  seedButton: {
    border: "1px solid rgba(99,102,241,0.35)",
    background: "rgba(99,102,241,0.1)",
    color: "#4338ca",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 160ms ease, filter 160ms ease",
  },
  inputCard: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 10px 20px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.2)",
    padding: 20,
    display: "grid",
    gap: 14,
    transition: "box-shadow 180ms ease",
    animation: "fadeSlideIn 420ms ease both",
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.3)",
    padding: 14,
    fontSize: "0.98rem",
    lineHeight: 1.5,
    resize: "vertical",
  },
  primaryButton: {
    width: "fit-content",
    border: 0,
    borderRadius: 10,
    background: "#4f46e5",
    color: "#ffffff",
    fontWeight: 700,
    padding: "10px 16px",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(79,70,229,0.25)",
    transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
  },
  twoColGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 10px 20px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.2)",
    padding: 20,
    animation: "fadeSlideIn 460ms ease both",
  },
  cardHeader: {
    fontWeight: 700,
    marginBottom: 12,
  },
  stack: {
    display: "grid",
    gap: 10,
  },
  feedRow: {
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 12,
    padding: 12,
    background: "#f8fafc",
  },
  feedSummary: {
    fontWeight: 600,
    marginBottom: 8,
  },
  feedMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  statusResolved: {
    color: "#166534",
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.35)",
    borderRadius: 999,
    padding: "4px 10px",
    fontWeight: 700,
    fontSize: "0.78rem",
  },
  statusFailed: {
    color: "#b45309",
    background: "rgba(245,158,11,0.15)",
    border: "1px solid rgba(245,158,11,0.35)",
    borderRadius: 999,
    padding: "4px 10px",
    fontWeight: 700,
    fontSize: "0.78rem",
  },
  feedTime: {
    fontSize: "0.82rem",
    color: "#64748b",
  },
  memoryRow: {
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 12,
    padding: 12,
    background: "#f8fafc",
    display: "grid",
    gap: 6,
  },
  memoryTitle: {
    fontWeight: 700,
  },
  memoryFix: {
    fontSize: "0.92rem",
    color: "#334155",
  },
  scoreBadge: {
    width: "fit-content",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#3730a3",
    background: "rgba(99,102,241,0.12)",
    borderRadius: 999,
    padding: "4px 8px",
    border: "1px solid rgba(99,102,241,0.3)",
  },
  comparisonPanel: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 10px 20px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.2)",
    padding: 20,
    animation: "fadeSlideIn 520ms ease both",
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  compareCard: {
    border: "1px solid rgba(148,163,184,0.3)",
    borderRadius: 14,
    padding: 14,
    background: "#f8fafc",
  },
  compareCardImproved: {
    border: "2px solid rgba(34,197,94,0.45)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(34,197,94,0.08)",
  },
  compareTitle: {
    fontWeight: 700,
    marginBottom: 10,
  },
  responseText: {
    margin: 0,
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    lineHeight: 1.5,
    fontSize: "0.95rem",
    color: "#0f172a",
  },
  insightList: {
    margin: 0,
    paddingLeft: 18,
    display: "grid",
    gap: 8,
  },
  actionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  successButton: {
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.15)",
    color: "#166534",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 160ms ease, filter 160ms ease",
  },
  failButton: {
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.12)",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 160ms ease, filter 160ms ease",
  },
  statusText: {
    margin: 0,
    color: "#334155",
    fontWeight: 500,
  },
  metaText: {
    margin: 0,
    color: "#64748b",
    fontSize: "0.86rem",
  },
  emptyText: {
    margin: 0,
    color: "#64748b",
    fontSize: "0.94rem",
  },
};
