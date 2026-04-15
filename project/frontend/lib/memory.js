const BASE_URL =
  String(process.env.HINDSIGHT_MCP_URL || "").trim() ||
  String(process.env.HINDSIGHT_BASE_URL || "").trim() ||
  "https://api.hindsight.vectorize.io/mcp/Incident_Intelligence";
const API_KEY = process.env.HINDSIGHT_API_KEY;
export const TEAM_ID = "opsmind-default";

const memoryCache = {};
let cachedMcpTools = null;
let mcpInitialized = false;
let rpcCounter = 0;

function ensureApiKey() {
  if (!API_KEY) {
    throw new Error("HINDSIGHT_API_KEY is not configured");
  }
}

function authorizationHeaderValue() {
  const value = String(API_KEY || "").trim();
  if (!value) {
    return "";
  }

  return /^bearer\s+/i.test(value) ? value : `Bearer ${value}`;
}

function normalizeMcpResult(result) {
  if (!result) return result;

  if (Array.isArray(result?.content)) {
    for (const item of result.content) {
      if (typeof item?.text === "string") {
        try {
          return JSON.parse(item.text);
        } catch {
          return item.text;
        }
      }
    }
  }

  if (Array.isArray(result?.memories)) {
    return result.memories;
  }

  if (Array.isArray(result)) {
    return result;
  }

  return result;
}

async function mcpRequest(method, params = {}) {
  ensureApiKey();

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Authorization": authorizationHeaderValue(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcCounter,
      method,
      params,
    }),
  });

  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { raw: responseText };
  }

  console.log(`Hindsight MCP ${method}:`, {
    status: response.status,
    ok: response.ok,
    body: data,
  });

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `MCP request failed (${response.status})`);
  }

  if (data?.error) {
    throw new Error(data.error?.message || data.error || `MCP ${method} error`);
  }

  return data.result ?? data;
}

async function ensureMcpInitialized() {
  if (mcpInitialized) return;

  try {
    await mcpRequest("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: {
        name: "OpsMind AI",
        version: "1.0.0",
      },
      capabilities: {},
    });
  } catch (error) {
    console.warn("Hindsight MCP initialize warning:", error.message);
  } finally {
    mcpInitialized = true;
  }
}

export async function listMcpTools() {
  if (Array.isArray(cachedMcpTools)) {
    return cachedMcpTools;
  }

  await ensureMcpInitialized();
  const result = await mcpRequest("tools/list", {});
  const tools = Array.isArray(result?.tools) ? result.tools : Array.isArray(result) ? result : [];
  cachedMcpTools = tools;
  return tools;
}

function pickTool(tools, mode) {
  const entries = Array.isArray(tools) ? tools : [];
  const scored = entries.map((tool) => {
    const name = String(tool?.name || "").toLowerCase();
    const description = String(tool?.description || "").toLowerCase();
    const haystack = `${name} ${description}`;
    let score = 0;

    if (mode === "store") {
      if (/store|save|write|create|insert/.test(haystack)) score += 3;
      if (/memory/.test(haystack)) score += 2;
      if (/incident|feedback|resolution/.test(haystack)) score += 1;
    } else {
      if (/search|retrieve|query|find|list|lookup/.test(haystack)) score += 3;
      if (/memory/.test(haystack)) score += 2;
      if (/incident|feedback|resolution/.test(haystack)) score += 1;
    }

    return { tool, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].tool : null;
}

async function callMcpTool(mode, args) {
  const tools = await listMcpTools();
  const tool = pickTool(tools, mode);

  if (!tool?.name) {
    throw new Error(`No matching MCP ${mode} tool found`);
  }

  const result = await mcpRequest("tools/call", {
    name: tool.name,
    arguments: args,
  });

  return normalizeMcpResult(result);
}

function getText(value) {
  return String(value || "").toLowerCase();
}

function normalizeMemories(data) {
  if (Array.isArray(data?.memories)) return data.memories;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

async function requestHindsight(paths, init) {
  let lastError = null;

  for (const endpointPath of paths) {
    const response = await fetch(`${BASE_URL}${endpointPath}`, init);
    const responseText = await response.text();

    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { raw: responseText };
    }

    lastError = {
      status: response.status,
      ok: response.ok,
      endpointPath,
      data,
    };

    if (response.ok) {
      return lastError;
    }

    // Keep probing on 404 because deployments can expose different API versions.
    if (response.status !== 404) {
      break;
    }
  }

  return lastError;
}

function clearMemoryCache() {
  Object.keys(memoryCache).forEach((key) => delete memoryCache[key]);
}

export function filterRelevantMemories(memories, input) {
  const query = getText(input);
  const isCacheOnly = query.includes("cache") && !query.includes("redis");

  return (Array.isArray(memories) ? memories : [])
    .map((memory) => {
      const text = getText(memory?.content);

      if (isCacheOnly && text.includes("redis")) {
        return {
          ...memory,
          relevance: 0,
        };
      }

      const keywordMatch =
        (query.includes("redis") && text.includes("redis")) ||
        (query.includes("cache") && text.includes("cache")) ||
        ((query.includes("database") || query.includes("db")) && /database|db|postgres|mysql|sql/.test(text));

      const overlap = query
        .split(/\W+/)
        .filter(Boolean)
        .reduce((count, token) => count + (text.includes(token) ? 1 : 0), 0);

      return {
        ...memory,
        relevance: Number((keywordMatch ? 0.75 + Math.min(0.2, overlap / 40) : 0.1 + Math.min(0.2, overlap / 60)).toFixed(2)),
      };
    })
    .filter((memory) => memory.relevance >= 0.35)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 2);
}

export function decideMemoryUsage(memories, input) {
  const relevant = filterRelevantMemories(memories, input);

  if (relevant.length === 0) {
    return {
      useMemory: false,
      reason: "No relevant memory found",
      memories: [],
    };
  }

  return {
    useMemory: true,
    reason: "Relevant memory found",
    memories: relevant,
  };
}

export async function storeMemory({ input, rootCause, fix, tags, error, root_cause, team_id }) {
  ensureApiKey();

  const incidentInput = String(input || error || "").trim();
  const incidentRootCause = String(rootCause || root_cause || "Unknown").trim();
  const incidentFix = typeof fix === "string" ? fix.trim() : String(fix?.fix || "").trim();

  const payload = {
    team_id: TEAM_ID,
    content: `Incident:
${incidentInput}

Root Cause:
${incidentRootCause}

Fix:
${incidentFix}`,
    metadata: {
      team_id: TEAM_ID,
      tags: Array.isArray(tags) && tags.length ? tags : ["incident"],
      score: 0.9,
      source: "opsmind-ai",
      error_summary: incidentInput.slice(0, 120),
      fix_summary: incidentFix.slice(0, 120),
      root_cause: incidentRootCause,
      stored_at: Date.now(),
    },
  };

  const result = await callMcpTool("store", {
    team_id: TEAM_ID,
    content: payload.content,
    metadata: payload.metadata,
  });

  clearMemoryCache();

  return {
    ...(result || {}),
    stored_memory: {
      content: payload.content,
      metadata: payload.metadata,
      relevance: 0.9,
    },
    status: "stored",
  };
}

export async function retrieveMemory(query, topK = 2) {
  ensureApiKey();

  const result = await callMcpTool("search", {
    team_id: TEAM_ID,
    query: String(query || ""),
    top_k: topK,
  });

  return normalizeMemories(result);
}

export async function searchMemories(query) {
  try {
    return await retrieveMemory(query, 5);
  } catch (error) {
    console.error("Hindsight RETRIEVE error:", error);
    return [];
  }
}

export async function cachedSearch(query) {
  const key = `${TEAM_ID}::${String(query || "").trim().toLowerCase()}`;
  if (!key.trim()) return [];

  if (memoryCache[key]) {
    return memoryCache[key];
  }

  const result = await searchMemories(query);
  memoryCache[key] = result;
  return result;
}
