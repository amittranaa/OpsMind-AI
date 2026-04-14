const rateMap = new Map();

function normalizeIp(ipValue) {
  const raw = Array.isArray(ipValue) ? ipValue[0] : ipValue;
  const first = String(raw || "local").split(",")[0].trim();
  return first || "local";
}

export function rateLimit(ipValue, limit = 20, windowMs = 60000) {
  const ip = normalizeIp(ipValue);
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };

  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count += 1;
  rateMap.set(ip, entry);

  return entry.count <= limit;
}
