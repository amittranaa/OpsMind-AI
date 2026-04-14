import { cachedSearch } from "../../lib/memory";
import { callLLM } from "../../lib/llm";
import { rateLimit } from "../../lib/rate-limit";

function shortenForPrompt(text, maxChars = 1400) {
  const value = String(text || "").trim();
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}...`;
}

async function planner(error) {
  const prompt = `You are a senior DevOps engineer analyzing infrastructure incidents.
  
Incident:
${error}

Analyze and categorize this incident. Return JSON:
{
  "category": "PERFORMANCE|AVAILABILITY|SECURITY|CONFIG|RESOURCE|NETWORK|DATABASE|APPLICATION",
  "keywords": ["key", "search", "terms"],
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "likely_layer": "INFRASTRUCTURE|APPLICATION|DATABASE|NETWORK",
  "investigation_hints": ["hint1", "hint2"]
}
`;

  const plan = await callLLM(prompt);

  return {
    category: String(plan?.category || "UNKNOWN").toUpperCase(),
    severity: String(plan?.severity || "MEDIUM").toUpperCase(),
    layer: String(plan?.likely_layer || "APPLICATION").toUpperCase(),
    keywords: Array.isArray(plan?.keywords) ? plan.keywords : [],
    hints: Array.isArray(plan?.investigation_hints) ? plan.investigation_hints : [],
  };
}

function buildFinalPrompt(error, plan, memories) {
  const incidents = memories
    .map((m, i) => {
      const score = Number(m?.metadata?.score || 0).toFixed(2);
      const outcome = m?.metadata?.outcome || "unknown";
      return `[${i + 1}] ${m?.content || ""} | Outcome: ${outcome} | Score: ${score}`;
    })
    .join("\n");

  return `You are a SENIOR DEVOPS ENGINEER analyzing production incidents.

CURRENT INCIDENT:
Category: ${plan.category}
Severity: ${plan.severity}
Layer: ${plan.layer}

ERROR DETAILS:
${error}

PAST SIMILAR INCIDENTS (Memory-backed context):
${incidents || "No relevant incidents found."}

ANALYSIS FRAMEWORK:
1. DO NOT just repeat memory solutions - they are guidance only
2. Identify ROOT CAUSE from patterns, not guesses
3. Create SCALABLE, PRODUCTION-GRADE FIX (not band-aids)
4. Suggest proactive monitoring/prevention strategies
5. Consider team context and deployment constraints

REQUIRED RESPONSE (JSON):
{
  "root_cause": "Deep analysis of underlying issue (1-2 sentences)",
  "fix": "Concrete, immediately actionable solution (detailed)",
  "steps": "Step-by-step implementation guide with commands/configs",
  "confidence": 0.0-1.0,
  "monitoring": "How to verify fix + prevent recurrence",
  "scalability_notes": "How this scales beyond single instance/team"
}
`;
}

function buildBasePrompt(error) {
  return `You are a SENIOR DEVOPS ENGINEER.

INCIDENT:
${error}

WITHOUT external memory context, analyze this production incident and provide:

{
  "root_cause": "Technical root cause analysis",
  "fix": "Immediate, scalable solution",
  "steps": "Implementation steps",
  "confidence": 0.0-1.0,
  "monitoring": "Verification and prevention",
  "scalability_notes": "Scalable beyond one instance"
}
`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local";
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  try {
    const { error } = req.body;
    const team_id = req.headers["x-team-id"] || process.env.DEFAULT_TEAM_ID || "opsmind-default";
    const user_id = req.headers["x-user-id"] || process.env.DEFAULT_USER_ID || "ops-user";

    console.log("REQ BODY:", req.body);

    if (!error || typeof error !== "string" || !error.trim()) {
      return res.status(400).json({ error: "error is required" });
    }

    const conciseError = shortenForPrompt(error);
    const plan = await planner(conciseError);
    console.log("PLAN:", plan);

    const category = String(plan?.category || "UNKNOWN").toUpperCase();
    const plannerKeywords = Array.isArray(plan?.keywords) ? plan.keywords : [];
    const searchQuery = plannerKeywords.length ? plannerKeywords.join(" ") : conciseError;

    let memories = [];
    try {
      memories = await cachedSearch(searchQuery, team_id);
      console.log("MEMORIES RETRIEVED:", memories?.length);
    } catch (e) {
      console.error("HINDSIGHT ERROR:", e);
      memories = [];
    }

    // Filter for HIGH QUALITY memories only (score > 0.7)
    const filteredMemories = (Array.isArray(memories) ? memories : [])
      .filter((m) => (m?.metadata?.score || 0) > 0.7)
      .slice(0, 5);

    const basePrompt = buildBasePrompt(conciseError);
    const improvedPrompt = buildFinalPrompt(conciseError, plan, filteredMemories);

    let base;
    let improved;

    try {
      [base, improved] = await Promise.all([
        callLLM(basePrompt),
        callLLM(improvedPrompt),
      ]);
      console.log("LLM ANALYSIS:", { base, improved, memory_hits: filteredMemories.length });
    } catch (e) {
      console.error("LLM ERROR:", e);
      base = { 
        root_cause: "Analysis failed", 
        fix: "Retry with diagnostic logs", 
        steps: "1. Gather system logs\n2. Check monitoring dashboards\n3. Review recent changes",
        confidence: 0.1,
        monitoring: "Enable verbose logging",
        scalability_notes: "N/A"
      };
      improved = base;
    }

    // Enhanced confidence scoring
    const baseConfidence = Number(base?.confidence || 0);
    const improvedConfidence = Number(improved?.confidence || 0);
    
    // Boost confidence based on memory hits and plan quality
    const memoryHitBoost = Math.min(0.15, filteredMemories.length * 0.05);
    const adjustedImprovedConfidence = Math.min(1.0, improvedConfidence + memoryHitBoost);
    
    const improvement = Math.max(
      0,
      Math.round((adjustedImprovedConfidence - baseConfidence) * 100)
    );

    res.json({
      base,
      improved: {
        ...improved,
        confidence: adjustedImprovedConfidence,
      },
      used_memories: filteredMemories,
      memory_used: filteredMemories.length,
      learning_mode: "ACTIVE",
      memory_entries: Array.isArray(memories) ? memories.length : 0,
      improvement: `${improvement}%`,
      category: plan.category,
      severity: plan.severity,
      layer: plan.layer,
      hints: plan.hints,
      plan,
      team_id,
      user_id,
    });
  } catch (err) {
    console.error("GENERATE ERROR:", err);
    res.status(200).json({
      base: {
        root_cause: "System fallback",
        fix: "Check logs and restart service",
        steps: "Validate service health and retry",
        confidence: 0.2,
      },
      improved: {
        root_cause: "System fallback",
        fix: "Check logs and restart service",
        steps: "Validate service health and retry",
        confidence: 0.2,
      },
      used_memories: [],
      memory_used: 0,
      learning_mode: "FALLBACK",
      memory_entries: 0,
      improvement: "0%",
      category: "UNKNOWN",
      mode: "fallback",
    });
  }
}
