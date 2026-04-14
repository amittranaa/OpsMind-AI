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
  const prompt = `
Analyze this issue:
${error}

Return JSON:
{
  "category": "",
  "keywords": []
}
`;

  const plan = await callLLM(prompt);

  return {
    category: String(plan?.category || "unknown").toUpperCase(),
    keywords: Array.isArray(plan?.keywords) ? plan.keywords : [],
  };
}

function buildFinalPrompt(error, plan, memories) {
  const incidents = memories
    .map((m, i) => {
      const score = Number(m?.metadata?.score || 0).toFixed(2);
      return `Incident ${i + 1}: ${m?.content || ""} (score: ${score})`;
    })
    .join("\n");

  return `
Category: ${plan.category}

Past incidents:
${incidents || "No relevant incidents found."}

Solve:
${error}

Return JSON:
{
  "root_cause": "",
  "fix": "",
  "steps": "",
  "confidence": 0.0
}
`;
}

function buildBasePrompt(error) {
  return `
Solve this issue:
${error}

Return ONLY JSON:
{
  "root_cause": "",
  "fix": "",
  "steps": "",
  "confidence": 0.0
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
      console.log("MEMORIES:", memories?.length);
    } catch (e) {
      console.error("HINDSIGHT ERROR:", e);
      memories = [];
    }

    const filteredMemories = (Array.isArray(memories) ? memories : [])
      .filter((m) => (m?.metadata?.score || 0) > 0.6)
      .slice(0, 3);

    const basePrompt = buildBasePrompt(conciseError);
    const improvedPrompt = buildFinalPrompt(conciseError, plan, filteredMemories);

    let base;
    let improved;

    try {
      [base, improved] = await Promise.all([
        callLLM(basePrompt),
        callLLM(improvedPrompt),
      ]);
      console.log("LLM RAW:", { base, improved });
    } catch (e) {
      console.error("LLM ERROR:", e);
      base = { root_cause: "Parsing failed", fix: "Retry request", confidence: 0.2 };
      improved = { root_cause: "Parsing failed", fix: "Retry request", confidence: 0.2 };
    }

    const baseConfidence = Number(base?.confidence || 0);
    const improvedConfidence = Number(improved?.confidence || 0);
    const improvement = Math.max(
      0,
      Math.round((improvedConfidence - baseConfidence) * 100)
    );

    res.json({
      base,
      improved,
      used_memories: filteredMemories,
      memory_used: filteredMemories.length,
      learning_mode: "ACTIVE",
      memory_entries: Array.isArray(memories) ? memories.length : 0,
      improvement: `${improvement}%`,
      category,
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
