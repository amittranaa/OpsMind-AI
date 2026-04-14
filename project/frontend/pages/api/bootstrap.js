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
      error: "Redis timeout errors under high load, response time 5000ms",
      fix: "Increased Redis timeout from 2s to 5s, scaled Redis instance to 16GB, implemented connection pooling with max 100 connections. Deployed at 2024-03-15 06:30 UTC. Monitoring latency p99 < 100ms.",
      outcome: "success",
      score: 0.95,
      root_cause: "Redis instance overloaded during traffic spike causing timeout errors on cache lookups",
      steps: "1. Increase timeout in redis.conf to 5000ms\n2. Scale vertically to 16GB memory\n3. Add connection pooling (100 max connections)\n4. Monitor with CloudWatch p99 latency metric",
      monitoring: "Track p99 latency < 100ms and connection pool utilization < 80%",
    },
    {
      error: "Database connection refused after deployment, max connections exceeded",
      fix: "Restarted PostgreSQL service, increased max_connections from 100 to 500, deployed connection pooling. Rollback took 2 minutes. Service restored.",
      outcome: "success",
      score: 0.92,
      root_cause: "New application deployment opened connections without releasing them, exhausting connection pool",
      steps: "1. Restart PostgreSQL: sudo systemctl restart postgresql\n2. Update postgresql.conf: max_connections=500\n3. Increase shared_buffers to 4GB\n4. Deploy PgBouncer for connection pooling",
      monitoring: "Alert when active connections > 400. Monitor connection age to detect leaks.",
    },
    {
      error: "API response latency degradation, p99 increased from 100ms to 500ms over 3 hours",
      fix: "Horizontal scaling: added 5 new app servers by increasing replica set from 3 to 8 instances. Auto-scaling policy adjusted to CPU > 70%. Latency returned to 90ms baseline.",
      outcome: "success",
      score: 0.89,
      root_cause: "Gradual traffic increase (20% per hour) exceeded capacity of 3 instances, no auto-scaling triggers",
      steps: "1. Scale current replica set to 8 instances\n2. Configure auto-scaling: scale up when CPU > 70%, scale down when CPU < 40%\n3. Set min instances = 3, max instances = 20\n4. Pre-warm instances to reduce start time to < 30s",
      monitoring: "Track p50, p95, p99 latency. Alert if p99 > 200ms. Monitor instance count and CPU utilization.",
    },
    {
      error: "Memory leak in Node.js service, heap size growing from 256MB to 2GB over 24 hours",
      fix: "Restart service every 8 hours via cron, implemented heap snapshot analysis, found circular reference in event listeners. Patched listener cleanup in v2.3.1. Heap now stable at 300MB.",
      outcome: "success",
      score: 0.88,
      root_cause: "Event listeners not being removed when objects destroyed, causing circular references and memory retention",
      steps: "1. Add hourly heap snapshots to identify memory patterns\n2. Review event listener cleanup code\n3. Use --expose-gc flag to force garbage collection tests\n4. Implement graceful shutdown to clear resources\n5. Deploy fix v2.3.1\n6. Schedule automatic restarts every 12 hours as safeguard",
      monitoring: "Monitor heap size with alerts at 1GB. Track garbage collection frequency and pause times.",
    },
    {
      error: "SSL certificate expired, browsers showing security warning, 15% traffic drop",
      fix: "Renewed certificate from Let's Encrypt, deployed to load balancer within 5 minutes. Added certificate expiration monitoring with 30-day and 7-day alerts.",
      outcome: "success",
      score: 0.91,
      root_cause: "SSL certificate renewal automation failed, manual renewal not scheduled",
      steps: "1. Run: certbot renew --force-renewal\n2. Deploy new certificate to nginx/load-balancer\n3. Verify: openssl s_client -connect domain.com:443\n4. Set up renewal automation: certbot with auto-renewal cron job\n5. Configure monitoring alerts at 30 days and 7 days before expiry",
      monitoring: "Monthly certificate expiry check. Alert if renewal fails. Verify HTTPS on all endpoints.",
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
