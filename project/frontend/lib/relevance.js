function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function getMemoryText(memory) {
  return normalizeText(
    `${memory?.content || ""} ${memory?.metadata?.error_summary || ""} ${memory?.metadata?.fix_summary || ""}`
  );
}

export function domain(error) {
  const text = normalizeText(error);
  if (text.includes("cache")) return "cache";
  if (text.includes("redis")) return "redis";
  if (text.includes("database")) return "db";
  return "generic";
}

export function domainMatch(error, memory) {
  const currentDomain = domain(error);
  if (currentDomain === "generic") return true;

  const memoryText = getMemoryText(memory);
  if (currentDomain === "db") {
    return /db|database|postgres|mysql|sql/.test(memoryText);
  }
  if (currentDomain === "redis") {
    return memoryText.includes("redis");
  }
  if (currentDomain === "cache") {
    return /cache|ttl|invalidation|stampede|cache hit|cache miss|thrash/.test(memoryText);
  }
  return true;
}

export function computeRelevance(error, memory) {
  const e = normalizeText(error);
  const m = getMemoryText(memory);

  let score = 0;

  if (e.includes("cache") && m.includes("cache")) score += 0.5;
  if (e.includes("redis") && m.includes("redis")) score += 0.5;
  if (e.includes("database") && m.includes("database")) score += 0.5;
  if (e.includes("api") && m.includes("api")) score += 0.3;

  const eTokens = new Set(e.split(/\W+/).filter(Boolean));
  const mTokens = new Set(m.split(/\W+/).filter(Boolean));
  let overlap = 0;
  eTokens.forEach((token) => {
    if (mTokens.has(token)) overlap += 1;
  });

  score += Math.min(0.5, overlap / 20);

  return Math.min(1, score);
}

export function selectMemories(error, memories) {
  const scored = (Array.isArray(memories) ? memories : []).map((memory) => ({
    ...memory,
    relevance: computeRelevance(error, memory),
  }));

  const filtered = scored
    .filter((memory) => memory.relevance >= 0.35 && domainMatch(error, memory))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 2);

  const mode = filtered.length ? "memory+reasoning" : "reasoning_only";

  return { filtered, mode, scored };
}