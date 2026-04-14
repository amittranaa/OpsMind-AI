async function callGroq(prompt, model) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return ONLY JSON" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      error: `LLM request failed with ${res.status}`,
      raw: data,
      model,
    };
  }

  return safeParse(data?.choices?.[0]?.message?.content || "");
}

export async function callLLM(prompt) {
  const models = [
    process.env.GROQ_MODEL,
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
  ].filter(Boolean);

  let lastError = null;

  for (const model of models) {
    const result = await callGroq(prompt, model);

    if (!result?.error) {
      return result;
    }

    lastError = result;

    if (String(result.raw?.error?.code || "").toLowerCase() !== "model_decommissioned") {
      return result;
    }
  }

  return lastError || { error: "LLM failed after retries" };
}

export function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {
      root_cause: "Parsing failed",
      fix: "Retry request",
      confidence: 0.2,
      raw: text,
    };
  }
}

export function plannerPrompt(error) {
  return `
Classify and analyze this issue:
${error}

Return JSON:
{
  "category": "",
  "severity": "",
  "keywords": []
}
`;
}

export async function scoreMemory(error, fix, outcome) {
  const prompt = `
Evaluate this fix:

Error: ${error}
Fix: ${fix}
Outcome: ${outcome}

Return JSON:
{
 "score": 0.0 to 1.0,
 "reason": ""
}
`;

  const result = await callLLM(prompt);

  if (result && typeof result === "object" && typeof result.score === "number") {
    return result;
  }

  return {
    score: String(outcome).toLowerCase() === "success" ? 1.0 : 0.2,
    reason: "Fallback rule-based score",
  };
}

export async function classifyError(error) {
  const prompt = `
Classify this error into one category:

Categories:
- database
- network
- timeout
- configuration
- unknown

Error:
${error}

Return JSON:
{ "category": "" }
`;

  return await callLLM(prompt);
}
