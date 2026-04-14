import { storeMemory } from "../../lib/memory";
import { rateLimit } from "../../lib/rate-limit";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local";
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const team_id = req.headers["x-team-id"] || process.env.DEFAULT_TEAM_ID || "opsmind-default";
  const user_id = req.headers["x-user-id"] || process.env.DEFAULT_USER_ID || "platform-bootstrap";

  const samples = [
    {
      error: "Redis timeout",
      fix: "Increase timeout to 5s",
      outcome: "success",
      score: 0.95,
    },
    {
      error: "DB connection refused",
      fix: "Restart DB service",
      outcome: "success",
      score: 0.9,
    },
    {
      error: "API latency high",
      fix: "Scale instances",
      outcome: "success",
      score: 0.85,
    },
  ];

  try {
    for (const sample of samples) {
      await storeMemory({
        ...sample,
        team_id,
        user_id,
        ts: Date.now(),
      });
    }

    return res.status(200).json({ status: "bootstrapped", count: samples.length, team_id });
  } catch (e) {
    console.error("BOOTSTRAP ERROR:", e);
    return res.status(500).json({ error: "bootstrap_failed" });
  }
}
