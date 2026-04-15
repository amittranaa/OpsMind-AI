import { debugCallMcpToolByName, debugMcpTools } from "../../lib/memory";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { call, q } = req.query;

    if (call === "list_memories") {
      const raw = await debugCallMcpToolByName("list_memories", {
        q: String(q || ""),
        limit: 20,
        offset: 0,
      });
      return res.status(200).json({ tools: raw, query: q || "" });
    }

    const tools = await debugMcpTools();
    return res.status(200).json({ tools });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}