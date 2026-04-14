import { storeMemory } from "../../lib/memory";
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

  const { error, fix, outcome } = req.body;
  const team_id = req.headers["x-team-id"] || process.env.DEFAULT_TEAM_ID || "opsmind-default";
  const user_id = req.headers["x-user-id"] || process.env.DEFAULT_USER_ID || "ops-user";

  if (!error || !fix || !outcome) {
    return res.status(400).json({ error: "error, fix, and outcome are required" });
  }

  if (!["success", "failed", "fail"].includes(String(outcome).toLowerCase())) {
    return res.status(400).json({ error: "outcome must be success or fail/failed" });
  }

  try {
    const normalizedFix =
      typeof fix === "string"
        ? fix
        : `${fix?.root_cause || ""} | ${fix?.fix || ""} | ${fix?.steps || ""}`.trim();

    let evaluated;
    try {
      evaluated = await scoreMemory(error, normalizedFix, outcome);
    } catch (scoreErr) {
      console.warn("SCORE ERROR:", scoreErr);
      evaluated = {
        score: String(outcome).toLowerCase() === "success" ? 1.0 : 0.2,
        reason: "Fallback rule-based score",
      };
    }

    await storeMemory({
      error,
      fix: normalizedFix,
      outcome,
      score: evaluated.score,
      team_id,
      user_id,
      ts: Date.now(),
    });

    res.json({
      status: "stored",
      score: evaluated.score,
      reason: evaluated.reason || "",
      team_id,
    });
  } catch (err) {
    console.error("FEEDBACK ERROR:", err);
    res.status(500).json({ error: "store_failed" });
  }
}
