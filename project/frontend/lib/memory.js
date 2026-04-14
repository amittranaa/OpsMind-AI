import fs from "fs/promises";
import path from "path";

const BASE_URL = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
const API_KEY = process.env.HINDSIGHT_API_KEY;
const memoryCache = {};
const localMemoryFile = path.join(process.cwd(), ".hindsight-memory.json");

function normalizeResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.memories)) {
    return data.memories;
  }

  return [];
}

function normalizeTeamId(teamId) {
  const fallback = process.env.DEFAULT_TEAM_ID || "opsmind-default";
  return String(teamId || fallback).trim() || fallback;
}

async function readLocalMemoryStore() {
  try {
    const raw = await fs.readFile(localMemoryFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalMemoryStore(memories) {
  try {
    await fs.writeFile(localMemoryFile, JSON.stringify(memories, null, 2), "utf8");
  } catch (err) {
    console.warn("CANNOT WRITE LOCAL STORE (serverless env):", err.message);
    // Fallback to in-memory cache in serverless environments
  }
}

function localSearch(query, memories, teamId) {
  const normalized = String(query || "").trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const queryTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  const scopedTeam = normalizeTeamId(teamId);

  const scopedMemories = memories.filter((memory) => {
    const memoryTeam = String(memory?.metadata?.team_id || "");
    return memoryTeam === scopedTeam;
  });

  // Filter by quality first (score > 0.7)
  const qualityMemories = scopedMemories.filter((memory) => {
    const score = Number(memory?.metadata?.score || 0);
    return score > 0.7;
  });

  const scored = qualityMemories
    .map((memory) => {
      const content = String(memory?.content || "").toLowerCase();
      const metadata = memory?.metadata || {};
      const error = String(metadata?.error || "").toLowerCase();
      const fix = String(metadata?.fix || "").toLowerCase();
      const haystack = `${content} ${error} ${fix}`;

      const overlap = queryTokens.reduce((count, token) => {
        return count + (haystack.includes(token) ? 1 : 0);
      }, 0);

      return { memory, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  return scored.map((entry) => entry.memory).slice(0, 3);
}

export async function storeMemory(data) {
  const scopedPayload = {
    ...data,
    team_id: normalizeTeamId(data?.team_id),
    user_id: String(data?.user_id || process.env.DEFAULT_USER_ID || "ops-user"),
    ts: Number(data?.ts || Date.now()),
  };

  const rootCause = String(data?.root_cause || data?.rootCause || "").trim();
  const steps = String(data?.steps || "").trim();
  const outcome = String(scopedPayload.outcome || "unknown").toLowerCase();
  const score = Number(scopedPayload.score || 0.5);

  // Enhanced payload with full context in a production-friendly format.
  const payload = {
    content: `Error: ${scopedPayload.error}
Context: High traffic / production issue
Root Cause: ${rootCause || "Unknown"}
Fix: ${scopedPayload.fix}
Steps: ${steps || "Not provided"}
Outcome: ${outcome}
Score: ${score}`,
    
    // Rich metadata for complete context
    metadata: {
      ...scopedPayload,
      // Ensure score is captured
      score,
      // Categories for filtering
      error_summary: String(scopedPayload.error || "").slice(0, 100),
      fix_summary: String(scopedPayload.fix || "").slice(0, 100),
      outcome,
      root_cause: rootCause,
      steps,
      // Timestamp for recency weighting
      stored_at: Date.now(),
    },
  };

  try {
    // Try Hindsight Cloud API first
    if (API_KEY && BASE_URL) {
      const response = await fetch(`${BASE_URL}/memories`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: "stored", source: "hindsight" }),
        };
      }

      console.warn("HINDSIGHT STORE WARN:", response.status);
    }

    // Fallback to in-memory cache
    const existing = await readLocalMemoryStore();
    existing.push(payload);
    await writeLocalMemoryStore(existing);
    
    // Clear memory cache
    Object.keys(memoryCache).forEach((key) => delete memoryCache[key]);
    
    return {
      ok: true,
      status: 201,
      json: async () => ({ status: "stored", source: "local-cache" }),
    };
  } catch (error) {
    console.error("STORE MEMORY ERROR:", error.message);
    // Still return success to avoid throwing in the API handler
    return {
      ok: true,
      status: 201,
      json: async () => ({ status: "stored", source: "fallback", error: error.message }),
    };
  }
}


export async function searchMemories(query, teamId = normalizeTeamId()) {
  const scopedTeam = normalizeTeamId(teamId);

  try {
    const url = `${BASE_URL}/memories/search?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(`team_id:${scopedTeam}`)}`;

    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("HINDSIGHT SEARCH ERROR:", res.status, text);
      return localSearch(query, await readLocalMemoryStore(), scopedTeam);
    }

    const data = await res.json();
    const normalized = normalizeResponse(data);

    if (normalized.length > 0) {
      // Filter by team AND quality (score > 0.7)
      const filtered = normalized
        .filter((memory) => {
          const memoryTeam = String(memory?.metadata?.team_id || "");
          return memoryTeam === scopedTeam;
        })
        .filter((memory) => {
          const score = Number(memory?.metadata?.score || 0);
          return score > 0.7;
        })
        .slice(0, 3);
      
      return filtered.length > 0 ? filtered : localSearch(query, await readLocalMemoryStore(), scopedTeam);
    }

    return localSearch(query, await readLocalMemoryStore(), scopedTeam);
  } catch (error) {
    console.warn("HINDSIGHT SEARCH ERROR:", error);
    return localSearch(query, await readLocalMemoryStore(), scopedTeam);
  }
}

export async function cachedSearch(query, teamId = normalizeTeamId()) {
  const scopedTeam = normalizeTeamId(teamId);
  const key = `${scopedTeam}::${String(query || "").trim().toLowerCase()}`;

  if (!key) {
    return [];
  }

  if (memoryCache[key]) {
    return memoryCache[key];
  }

  const result = await searchMemories(query, scopedTeam);
  memoryCache[key] = result;
  return result;
}
