import { listMcpTools } from "../../lib/memory";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const tools = await listMcpTools();
    return res.status(200).json({ tools });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}