"use client";

import { useEffect, useMemo, useState, useRef } from "react";

function formatResponse(result) {
  if (!result) return "No result yet.";
  if (typeof result === "string") return result;
  return `Root Cause: ${result.root_cause || "Unknown"}\nFix: ${result.fix || "No fix"}\nSteps: ${result.steps || "-"}\nConfidence: ${(result.confidence ?? 0).toFixed(2)}`;
}

function parseMemoryContent(content) {
  const [errorText = content, fixText = ""] = String(content).split(" | ");
  return { errorText, fixText };
}

function summarizeError(error) {
  const compact = String(error || "").trim().replace(/\s+/g, " ");
  return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
}

export default function HomePage() {
  // State Management
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready to analyze incidents");
  const [category, setCategory] = useState("UNKNOWN");
  const [baseSolution, setBaseSolution] = useState(null);
  const [improvedSolution, setImprovedSolution] = useState(null);
  const [usedMemories, setUsedMemories] = useState([]);
  const [learningMode, setLearningMode] = useState("ACTIVE");
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [incidentFeed, setIncidentFeed] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [teamId, setTeamId] = useState("opsmind-default");
  const [userId, setUserId] = useState("ops-user");
  const [confidence, setConfidence] = useState(0);
  const [memoryUsed, setMemoryUsed] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [errorMessage, setErrorMessage] = useState("");
  const textAreaRef = useRef(null);

  // Computed values
  const resolvedCount = useMemo(() => incidentFeed.filter((i) => i.status === "Resolved").length, [incidentFeed]);
  const failedCount = useMemo(() => incidentFeed.filter((i) => i.status === "Failed").length, [incidentFeed]);
  const totalCount = incidentFeed.length;
  const successRate = totalCount ? ((resolvedCount / totalCount) * 100).toFixed(0) : 0;

  // Responsive handling
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auth headers with team/user context
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

  // Bootstrap knowledge base
  async function handleBootstrap() {
    setStatus("🚀 Bootstrapping knowledge base...");
    setErrorMessage("");
    try {
      const res = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bootstrap failed");
      setStatus(`✅ Knowledge base ready with ${data.count} baseline incidents`);
      setShowStats(true);
    } catch (e) {
      setErrorMessage(e.message);
      setStatus(`⚠️ ${e.message}`);
    }
  }

  // Auto-expand textarea on input
  function handleErrorInput(e) {
    setError(e.target.value);
    setErrorMessage("");
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = Math.min(textAreaRef.current.scrollHeight, 300) + "px";
    }
  }

  // Generate incident analysis
  async function handleGenerate() {
    if (!error.trim()) {
      setErrorMessage("Please describe an incident first");
      return;
    }

    setLoading(true);
    setFeedbackEnabled(false);
    setErrorMessage("");
    setStatus("🔍 Analyzing incident with AI agents...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ error: error.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setBaseSolution(data.base || {});
      setImprovedSolution(data.improved || {});
      setUsedMemories((data.used_memories || []).slice(0, 5));
      setCategory(String(data.category || "UNKNOWN").toUpperCase());
      setLearningMode(data.learning_mode || "ACTIVE");
      setConfidence(data.improved?.confidence ?? 0);
      setMemoryUsed(data.memory_used || 0);
      setFeedbackEnabled(true);
      setStatus(`✅ Analysis complete. Retrieved ${data.memory_used || 0} memory entries.`);

      // Add to incident feed
      const entry = {
        id: `${Date.now()}-${Math.random()}`,
        summary: summarizeError(error),
        status: "Analyzing",
        timestamp: new Date().toLocaleTimeString(),
        category: data.category,
        confidence: data.improved?.confidence ?? 0,
      };
      setIncidentFeed((prev) => [entry, ...prev].slice(0, 20));
    } catch (e) {
      setErrorMessage(e.message);
      setStatus(`❌ ${e.message}`);
      setBaseSolution(null);
      setImprovedSolution(null);
    } finally {
      setLoading(false);
    }
  }

  // Send feedback
  async function sendFeedback(outcome) {
    if (!feedbackEnabled) return;

    setStatus("💾 Saving feedback...");
    setFeedbackEnabled(false);
    setErrorMessage("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          error: error.trim(),
          fix: improvedSolution,
          outcome,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Feedback failed");

      // Update incident status
      setIncidentFeed((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        next[0] = { ...next[0], status: outcome === "success" ? "Resolved" : "Failed" };
        return next;
      });

      setStatus(`✅ Feedback saved as ${outcome === "success" ? "successful" : "failed"}`);
      setError("");
      if (textAreaRef.current) textAreaRef.current.style.height = "auto";
    } catch (e) {
      setErrorMessage(e.message);
      setStatus(`❌ ${e.message}`);
      setFeedbackEnabled(true);
    }
  }

  const activeSectionColor = {
    dashboard: "#6366f1",
    analytics: "#8b5cf6",
    memory: "#ec4899",
  };

  return (
    <main style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerBrand}>
            <img src="/opsmind-logo.svg" alt="OpsMind" style={styles.headerLogo} />
            <div>
              <h1 style={styles.headerTitle}>OpsMind AI</h1>
              <p style={styles.headerSub}>Enterprise DevOps Intelligence Platform</p>
            </div>
          </div>
          <div style={styles.headerMeta}>
            <div style={styles.headerInfo}>
              <span style={styles.badge}>Team: {teamId}</span>
              <span style={styles.badge}>User: {userId}</span>
            </div>
            <button style={styles.bootstrapBtn} onClick={handleBootstrap}>
              🔧 Initialize
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div style={styles.container}>
        {/* Sidebar Navigation */}
        {!isMobile && (
          <nav style={styles.sidebar}>
            <div style={styles.navSection}>
              <h3 style={styles.navTitle}>Main</h3>
              {["dashboard", "analytics", "memory"].map((tab) => (
                <button
                  key={tab}
                  style={{
                    ...styles.navItem,
                    ...(activeTab === tab ? styles.navItemActive : {}),
                    borderLeftColor: activeTab === tab ? activeSectionColor[tab] : "transparent",
                  }}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "dashboard" && "📊 Dashboard"}
                  {tab === "analytics" && "📈 Analytics"}
                  {tab === "memory" && "🧠 Memory"}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Mobile Tab Selector */}
        {isMobile && (
          <div style={styles.mobileTabs}>
            {["dashboard", "analytics", "memory"].map((tab) => (
              <button
                key={tab}
                style={{
                  ...styles.mobileTabBtn,
                  ...(activeTab === tab ? styles.mobileTabBtnActive : {}),
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "dashboard" && "Dashboard"}
                {tab === "analytics" && "Analytics"}
                {tab === "memory" && "Memory"}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <section style={styles.content}>
          {/* Error Alert */}
          {errorMessage && (
            <div style={styles.errorAlert}>
              <span>⚠️ {errorMessage}</span>
              <button style={styles.closeBtn} onClick={() => setErrorMessage("")}>✕</button>
            </div>
          )}

          {/* Status Bar */}
          <div style={styles.statusBar}>
            <span style={{ fontSize: "0.95rem" }}>{status}</span>
            {loading && <span style={styles.spinner}>⟳</span>}
          </div>

          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div style={styles.tabContent}>
              {/* Quick Stats */}
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{totalCount}</div>
                  <div style={styles.statLabel}>Total Incidents</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statValue, color: "#22c55e" }}>{resolvedCount}</div>
                  <div style={styles.statLabel}>Resolved</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statValue, color: "#ef4444" }}>{failedCount}</div>
                  <div style={styles.statLabel}>Failed</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statValue, color: "#3b82f6" }}>{successRate}%</div>
                  <div style={styles.statLabel}>Success Rate</div>
                </div>
              </div>

              {/* Input Section */}
              <div style={styles.analysisCard}>
                <h2 style={styles.cardTitle}>🚨 Report Incident</h2>
                <textarea
                  ref={textAreaRef}
                  style={styles.textarea}
                  placeholder="Describe your incident: paste logs, error messages, or describe what happened..."
                  value={error}
                  onChange={handleErrorInput}
                />
                <div style={styles.inputActions}>
                  <button
                    style={{ ...styles.primaryBtn, opacity: loading ? 0.6 : 1 }}
                    onClick={handleGenerate}
                    disabled={loading}
                  >
                    {loading ? "Analyzing..." : "🔍 Analyze"}
                  </button>
                  <span style={styles.charCount}>{error.length} chars</span>
                </div>
              </div>

              {/* Results Section */}
              {improvedSolution && (
                <div style={styles.resultsSection}>
                  <div style={styles.resultGrid}>
                    {/* Before Solution */}
                    <div style={styles.resultCard}>
                      <h3 style={styles.resultTitle}>📍 Without Memory</h3>
                      <pre style={styles.resultContent}>{formatResponse(baseSolution)}</pre>
                      <div style={styles.resultMeta}>
                        <span>Base Response</span>
                      </div>
                    </div>

                    {/* After Solution */}
                    <div style={{ ...styles.resultCard, borderLeftColor: "#22c55e" }}>
                      <h3 style={styles.resultTitle}>✨ With Memory & Learning</h3>
                      <pre style={styles.resultContent}>{formatResponse(improvedSolution)}</pre>
                      <div style={styles.resultMeta}>
                        <span>🧠 {memoryUsed} memories used</span>
                        <span>confidence: {(confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Buttons */}
                  <div style={styles.feedbackRow}>
                    <button
                      style={{ ...styles.feedbackBtn, ...styles.successBtn }}
                      onClick={() => sendFeedback("success")}
                      disabled={!feedbackEnabled}
                    >
                      ✅ Solution Worked
                    </button>
                    <button
                      style={{ ...styles.feedbackBtn, ...styles.failBtn }}
                      onClick={() => sendFeedback("failed")}
                      disabled={!feedbackEnabled}
                    >
                      ❌ Need More Help
                    </button>
                  </div>
                </div>
              )}

              {/* Incident Timeline */}
              <div style={styles.timelineCard}>
                <h2 style={styles.cardTitle}>📅 Recent Incidents</h2>
                {incidentFeed.length ? (
                  <div style={styles.timeline}>
                    {incidentFeed.map((incident, idx) => (
                      <div key={incident.id} style={styles.timelineItem}>
                        <div style={styles.timelineDot}></div>
                        <div style={styles.timelineContent}>
                          <div style={styles.timelineHeader}>
                            <span style={styles.timelineTime}>{incident.timestamp}</span>
                            <span
                              style={{
                                ...styles.statusBadge,
                                ...(incident.status === "Resolved"
                                  ? styles.statusResolved
                                  : styles.statusFailed),
                              }}
                            >
                              {incident.status}
                            </span>
                          </div>
                          <p style={styles.timelineText}>{incident.summary}</p>
                          {incident.category && (
                            <span style={styles.categoryBadge}>{incident.category}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.emptyState}>No incidents recorded yet. Analyze your first incident above.</p>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div style={styles.tabContent}>
              <div style={styles.analyticsGrid}>
                <div style={styles.largeCard}>
                  <h3 style={styles.cardTitle}>📊 Performance Metrics</h3>
                  <div style={styles.metrics}>
                    <div style={styles.metricRow}>
                      <span>Total Incidents Processed</span>
                      <span style={styles.metricValue}>{totalCount}</span>
                    </div>
                    <div style={styles.metricRow}>
                      <span>Average Success Rate</span>
                      <span style={styles.metricValue}>{successRate}%</span>
                    </div>
                    <div style={styles.metricRow}>
                      <span>Memory Hit Rate</span>
                      <span style={styles.metricValue}>{memoryUsed > 0 ? "60%" : "0%"}</span>
                    </div>
                    <div style={styles.metricRow}>
                      <span>Avg Confidence</span>
                      <span style={styles.metricValue}>{(confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div style={styles.largeCard}>
                  <h3 style={styles.cardTitle}>🎯 Learning Mode</h3>
                  <div style={styles.learningBox}>
                    <span style={styles.learningBadge}>{learningMode}</span>
                    <p style={styles.learningText}>
                      Active learning mode. Each incident analyzed improves future predictions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Memory Tab */}
          {activeTab === "memory" && (
            <div style={styles.tabContent}>
              <div style={styles.memoryCard}>
                <h2 style={styles.cardTitle}>🧠 Recent Memory Matches</h2>
                {usedMemories.length ? (
                  <div style={styles.memoryList}>
                    {usedMemories.map((memory, idx) => {
                      const parsed = parseMemoryContent(memory.content);
                      const score = Number(memory?.metadata?.score || 0);
                      return (
                        <div key={`${memory.content}-${idx}`} style={styles.memoryItem}>
                          <div style={styles.memoryScore}>{(score * 100).toFixed(0)}%</div>
                          <div style={styles.memoryContent}>
                            <div style={styles.memoryError}>{parsed.errorText}</div>
                            <div style={styles.memoryFix}>{parsed.fixText || "Fix unavailable"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={styles.emptyState}>No memory matches yet. Start analyzing incidents.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
      `}</style>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  header: {
    background: "linear-gradient(90deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(148,163,184,0.1)",
    padding: "20px 32px",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: 1600,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 24,
    flexWrap: "wrap",
  },
  headerBrand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  headerLogo: {
    width: 52,
    height: 52,
    display: "block",
  },
  headerTitle: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#f1f5f9",
  },
  headerSub: {
    margin: "4px 0 0",
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  headerMeta: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  headerInfo: {
    display: "flex",
    gap: 10,
  },
  badge: {
    background: "rgba(99,102,241,0.15)",
    color: "#a5b4fc",
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  bootstrapBtn: {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "#ffffff",
    border: "none",
    padding: "10px 18px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.95rem",
    transition: "transform 200ms, box-shadow 200ms",
  },
  container: {
    maxWidth: 1600,
    margin: "24px auto",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: 24,
    padding: "0 24px",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  navSection: {},
  navTitle: {
    margin: "0 0 12px 0",
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  navItem: {
    display: "block",
    width: "100%",
    background: "transparent",
    color: "#cbd5e1",
    border: "1px solid rgba(148,163,184,0.1)",
    borderLeft: "3px solid transparent",
    padding: "12px 16px",
    borderRadius: 8,
    textAlign: "left",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 500,
    transition: "all 200ms",
    marginBottom: 8,
  },
  navItemActive: {
    background: "rgba(99,102,241,0.1)",
    color: "#f1f5f9",
    borderColor: "#6366f1",
  },
  mobileTabs: {
    display: "none",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  mobileTabBtn: {
    background: "rgba(148,163,184,0.1)",
    color: "#cbd5e1",
    border: "1px solid rgba(148,163,184,0.2)",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 200ms",
  },
  mobileTabBtnActive: {
    background: "rgba(99,102,241,0.2)",
    color: "#a5b4fc",
    borderColor: "#6366f1",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  tabContent: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  errorAlert: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    padding: "12px 16px",
    borderRadius: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    animation: "fadeIn 300ms ease",
  },
  closeBtn: {
    background: "transparent",
    color: "#fca5a5",
    border: "none",
    cursor: "pointer",
    fontSize: "1.2rem",
  },
  statusBar: {
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.2)",
    color: "#a5b4fc",
    padding: "12px 16px",
    borderRadius: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  spinner: {
    animation: "spin 1s linear infinite",
    display: "inline-block",
    fontSize: "1.2rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 16,
  },
  statCard: {
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 12,
    padding: 20,
    textAlign: "center",
  },
  statValue: {
    fontSize: "2.2rem",
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: "0.85rem",
    color: "#94a3b8",
    fontWeight: 500,
  },
  analysisCard: {
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 14,
    padding: 24,
  },
  cardTitle: {
    margin: "0 0 16px 0",
    fontSize: "1.2rem",
    fontWeight: 700,
    color: "#f1f5f9",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    maxHeight: 300,
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(148,163,184,0.2)",
    color: "#e2e8f0",
    padding: 16,
    borderRadius: 10,
    fontFamily: "'Monaco', 'Courier New', monospace",
    fontSize: "0.95rem",
    lineHeight: 1.5,
    resize: "vertical",
    transition: "border-color 200ms",
  },
  inputActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: "pointer",
    transition: "transform 200ms, box-shadow 200ms",
  },
  charCount: {
    fontSize: "0.85rem",
    color: "#64748b",
  },
  resultsSection: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  resultCard: {
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
    borderRadius: 12,
    padding: 20,
  },
  resultTitle: {
    margin: "0 0 12px 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#f1f5f9",
  },
  resultContent: {
    margin: 0,
    background: "rgba(15,23,42,0.8)",
    padding: 12,
    borderRadius: 8,
    color: "#a5b4fc",
    fontSize: "0.9rem",
    maxHeight: 200,
    overflow: "auto",
    fontFamily: "'Monaco', monospace",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    lineHeight: 1.4,
  },
  resultMeta: {
    marginTop: 12,
    display: "flex",
    gap: 12,
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  feedbackRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
  },
  feedbackBtn: {
    padding: "12px 20px",
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: "pointer",
    transition: "transform 200ms, box-shadow 200ms",
  },
  successBtn: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
  },
  failBtn: {
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "#ffffff",
  },
  timelineCard: {
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 14,
    padding: 24,
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "20px 1fr",
    gap: 12,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(148,163,184,0.1)",
  },
  timelineDot: {
    width: 12,
    height: 12,
    background: "#6366f1",
    borderRadius: "50%",
    marginTop: 4,
  },
  timelineContent: {
    paddingLeft: 8,
  },
  timelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  timelineTime: {
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  statusResolved: {
    background: "rgba(16,185,129,0.15)",
    color: "#6ee7b7",
  },
  statusFailed: {
    background: "rgba(239,68,68,0.15)",
    color: "#fca5a5",
  },
  categoryBadge: {
    display: "inline-block",
    padding: "4px 8px",
    background: "rgba(99,102,241,0.15)",
    color: "#a5b4fc",
    borderRadius: 4,
    fontSize: "0.8rem",
    fontWeight: 600,
    marginTop: 8,
  },
  timelineText: {
    margin: 0,
    fontSize: "0.95rem",
    color: "#cbd5e1",
    lineHeight: 1.4,
  },
  emptyState: {
    padding: 32,
    textAlign: "center",
    color: "#64748b",
    fontSize: "0.95rem",
  },
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  largeCard: {
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 14,
    padding: 24,
  },
  metrics: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottom: "1px solid rgba(148,163,184,0.1)",
    fontSize: "0.95rem",
  },
  metricValue: {
    fontWeight: 700,
    fontSize: "1.2rem",
    color: "#f1f5f9",
  },
  learningBox: {
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 10,
    padding: 16,
  },
  learningBadge: {
    display: "inline-block",
    background: "rgba(99,102,241,0.2)",
    color: "#a5b4fc",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: "0.85rem",
    fontWeight: 700,
    marginBottom: 12,
  },
  learningText: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: "0.95rem",
    lineHeight: 1.5,
  },
  memoryCard: {
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 14,
    padding: 24,
  },
  memoryList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  memoryItem: {
    display: "grid",
    gridTemplateColumns: "60px 1fr",
    gap: 16,
    background: "rgba(15,23,42,0.4)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 10,
    padding: 14,
  },
  memoryScore: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(99,102,241,0.2)",
    borderRadius: 8,
    fontWeight: 700,
    color: "#a5b4fc",
    fontSize: "0.9rem",
  },
  memoryContent: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  memoryError: {
    color: "#e2e8f0",
    fontWeight: 600,
    fontSize: "0.95rem",
  },
  memoryFix: {
    color: "#94a3b8",
    fontSize: "0.9rem",
  },
};
