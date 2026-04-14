export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).json({
    status: "ok",
    timestamp: Date.now(),
  });
}
