import { getActiveLLMMode } from "../../lib/llm";

function jsonHeaders(teamId, userId) {
  return {
    "Content-Type": "application/json",
    "x-team-id": teamId,
    "x-user-id": userId,
  };
}

function containsAny(text, patterns) {
  const value = String(text || "").toLowerCase();
  return patterns.some((p) => value.includes(p));
}

function evaluate(caseId, response) {
  const improved = response?.improved || {};
  const improvedText = `${improved?.root_cause || ""} ${improved?.fix || ""} ${improved?.steps || ""}`.toLowerCase();

  if (caseId === "multi-layer") {
    const pass =
      containsAny(improvedText, ["redis"]) &&
      containsAny(improvedText, ["database", "db", "query", "cpu"]) &&
      containsAny(improvedText, ["api", "timeout", "load balancer", "traffic"]);
    return { pass, note: pass ? "Detected multi-layer causes and fix scope." : "Did not clearly cover all layers." };
  }

  if (caseId === "memory-trap") {
    const mentionsHeap = containsAny(improvedText, ["heap", "memory leak", "out of memory"]);
    const avoidsRedisBias = !containsAny(improvedText, ["redis cluster", "redis timeout", "scale redis"]);
    const pass = mentionsHeap && avoidsRedisBias;
    return { pass, note: pass ? "Ignored irrelevant Redis memory and focused on heap issues." : "Potential irrelevant memory usage detected." };
  }

  if (caseId === "deployment-regression") {
    const targetsRegression = containsAny(improvedText, ["regression", "deployment", "release", "query"]);
    const avoidsBlindScaling = !containsAny(improvedText, ["scale instances", "add replicas only"]);
    const pass = targetsRegression && avoidsBlindScaling;
    return { pass, note: pass ? "Focused on code/release regression path." : "Looks too infra-generic for regression-only case." };
  }

  if (caseId === "redis-advanced") {
    const pass =
      containsAny(improvedText, ["connection exhaustion", "connection pool", "pooling"]) &&
      containsAny(improvedText, ["timeout"]);
    return { pass, note: pass ? "Detected Redis connection path issue." : "Missed connection-centric Redis diagnosis." };
  }

  if (caseId === "network-hard") {
    const pass = containsAny(improvedText, ["network", "service discovery", "load balancer", "dns", "inter-service"]);
    return { pass, note: pass ? "Detected microservice network path failure." : "Did not explicitly identify network/service-discovery path." };
  }

  return { pass: true, note: "Sequence case validated by sub-results." };
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const teamId = req.headers["x-team-id"] || process.env.DEFAULT_TEAM_ID || "opsmind-default";
  const userId = req.headers["x-user-id"] || process.env.DEFAULT_USER_ID || "judge-runner";

  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host;
  const baseUrl = `${proto}://${host}`;

  try {
    const runBootstrap = req.method === "POST" ? req.body?.bootstrap !== false : true;

    if (runBootstrap) {
      await fetch(`${baseUrl}/api/bootstrap`, {
        method: "POST",
        headers: jsonHeaders(teamId, userId),
      });
    }

    const cases = [
      {
        id: "multi-layer",
        label: "Multi-Layer Incident",
        prompt:
          "After a recent deployment, users are experiencing high latency and intermittent failures. Redis shows increased response times, database CPU usage is high, and API logs show timeout errors. Issue started immediately after scaling traffic.",
      },
      {
        id: "memory-trap",
        label: "Memory Trap Case",
        prompt:
          "Node.js API is crashing with JavaScript heap out of memory error under moderate load.",
      },
      {
        id: "deployment-regression",
        label: "Deployment Regression",
        prompt:
          "After deploying a new version, system latency increased significantly. Redis and database metrics are normal, but API response time doubled. No infrastructure changes were made.",
      },
      {
        id: "redis-advanced",
        label: "Advanced Redis Scenario",
        prompt:
          "Redis memory usage is stable but connection count is very high. API requests are slow and sometimes fail with connection timeout errors. Happens during peak hours.",
      },
      {
        id: "network-hard",
        label: "Microservice Network Issue",
        prompt:
          "Microservices are experiencing intermittent communication failures. Service A cannot reliably call Service B. Logs show timeout errors, but both services are running normally.",
      },
    ];

    const results = [];

    for (const testCase of cases) {
      const generateRes = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: jsonHeaders(teamId, userId),
        body: JSON.stringify({ error: testCase.prompt }),
      });
      const data = await generateRes.json();
      const evaluated = evaluate(testCase.id, data);

      results.push({
        id: testCase.id,
        label: testCase.label,
        pass: evaluated.pass,
        note: evaluated.note,
        memory_used: Number(data?.memory_used || 0),
        improvement: Number(data?.improvement || 0),
        confidence: Number(data?.improved?.confidence || 0),
      });
    }

    // Final master sequence.
    const sequence = [
      "Redis timeout under heavy load",
      "Redis delay after deployment with increased traffic",
      "API crashing due to memory leak",
    ];

    const sequenceOutputs = [];

    for (let i = 0; i < sequence.length; i += 1) {
      const prompt = sequence[i];
      const generateRes = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: jsonHeaders(teamId, userId),
        body: JSON.stringify({ error: prompt }),
      });
      const data = await generateRes.json();
      sequenceOutputs.push({
        step: i + 1,
        prompt,
        memory_used: Number(data?.memory_used || 0),
        improvement: Number(data?.improvement || 0),
        confidence: Number(data?.improved?.confidence || 0),
        improved_fix: String(data?.improved?.fix || ""),
      });

      if (i === 0) {
        await fetch(`${baseUrl}/api/feedback`, {
          method: "POST",
          headers: jsonHeaders(teamId, userId),
          body: JSON.stringify({
            error: prompt,
            fix: data?.improved || {},
            outcome: "success",
          }),
        });
      }
    }

    const sequencePass =
      sequenceOutputs[1]?.memory_used >= sequenceOutputs[0]?.memory_used &&
      !containsAny(sequenceOutputs[2]?.improved_fix || "", ["redis cluster", "scale redis instance"]);

    const passed = results.filter((r) => r.pass).length + (sequencePass ? 1 : 0);
    const total = results.length + 1;

    return res.status(200).json({
      llm_mode: getActiveLLMMode(),
      summary: {
        passed,
        total,
        score_percent: Math.round((passed / total) * 100),
      },
      cases: results,
      master_sequence: {
        pass: sequencePass,
        note: sequencePass
          ? "Sequence behavior looks correct: learning on step 2, relevance filtering on step 3."
          : "Sequence behavior needs tuning for memory relevance and progression.",
        outputs: sequenceOutputs,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "judge_test_failed",
      message: error?.message || "Unknown error",
      llm_mode: getActiveLLMMode(),
    });
  }
}
