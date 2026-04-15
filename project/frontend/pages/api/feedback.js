import { storeMemory, TEAM_ID } from "../../lib/memory";
import { scoreMemory } from "../../lib/llm";
import { rateLimit } from "../../lib/rate-limit";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local";
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const { error, input, rootCause, tags, fix, outcome } = req.body;
  const team_id = TEAM_ID;
  const user_id = req.headers["x-user-id"] || process.env.DEFAULT_USER_ID || "ops-user";

  const incidentInput = String(input || error || "").trim();
  if (!incidentInput || !fix || !outcome) {
    return res.status(400).json({ error: "input/error, fix, and outcome are required" });
  }

  const normalizedOutcome = String(outcome).toLowerCase();
  const storeAllowed = ["worked", "resolved", "success"].includes(normalizedOutcome);
  if (!storeAllowed && !["failed", "fail"].includes(normalizedOutcome)) {
    return res.status(400).json({ error: "outcome must be worked/resolved/success or fail/failed" });
  }

  if (!storeAllowed) {
    return res.status(200).json({
      status: "not_stored",
      reason: "Memory only stores after Worked/Resolved feedback",
      team_id,
    });
  }

  try {
    const normalizedFix =
      typeof fix === "string"
        ? fix
        : String(fix?.fix || "").trim();
    const normalizedRootCause = String(rootCause || (typeof fix === "object" ? fix?.root_cause : "") || "").trim();
    const steps = typeof fix === "object" ? String(fix?.steps || "").trim() : "";

    let evaluated;
    try {
      evaluated = await scoreMemory(incidentInput, normalizedFix, normalizedOutcome);
    } catch (scoreErr) {
      console.warn("SCORE ERROR:", scoreErr);
      evaluated = {
        score: 0.9,
        reason: "Fallback rule-based score",
      };
    }

    const stored = await storeMemory({
      input: incidentInput,
      fix: normalizedFix,
      rootCause: normalizedRootCause,
      steps,
      tags,
      team_id,
      user_id,
      ts: Date.now(),
    });

    console.log("FEEDBACK STORE RESULT:", stored);

    res.json({
      status: "stored",
      score: evaluated.score,
      reason: evaluated.reason || "",
      team_id,
      stored_memory: stored?.stored_memory || null,
    });
  } catch (err) {
    console.error("FEEDBACK ERROR:", err);
    res.status(500).json({ error: "store_failed", message: err.message });
  }
}
