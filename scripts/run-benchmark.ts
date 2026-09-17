import autocannon from 'autocannon';
import fs from 'fs';
import path from 'path';
import { SeedMeta } from './seed-benchmark';

export interface OperationMetrics {
  endpoint: string;
  operation: string;
  concurrency: number;
  requestsTotal: number;
  requestsPerSecAvg: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  errorsTotal: number;
  errorPercentage: number;
  statusCodes: Record<string, number>;
}

export interface BenchmarkReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    database: string;
    redis: string;
  };
  config: {
    baseUrl: string;
    concurrencyLevels: number[];
    durationSec: number;
    warmupSec: number;
  };
  results: OperationMetrics[];
}

async function runAutocannon(opts: autocannon.Options): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

export async function runBenchmarkSuite(options: {
  baseUrl?: string;
  concurrencyLevels?: number[];
  durationSec?: number;
  warmupSec?: number;
  targetOperation?: string;
}): Promise<BenchmarkReport> {
  const baseUrl = options.baseUrl || process.env.BENCHMARK_API_URL || 'http://localhost:4000';
  const concurrencyLevels = options.concurrencyLevels || [10, 25, 50];
  const durationSec = options.durationSec || 10;
  const warmupSec = options.warmupSec || 2;

  const metaPath = path.resolve(__dirname, '../benchmark-meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Benchmark metadata file not found at ${metaPath}. Run "npm run benchmark:seed" first.`);
  }

  const meta: SeedMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const operations = [
    {
      name: 'listIssues',
      endpoint: `/api/projects/${meta.projectId}/issues?limit=20&sortBy=createdAt&sortOrder=desc`,
      method: 'GET' as const,
    },
    {
      name: 'createIssue',
      endpoint: `/api/projects/${meta.projectId}/issues`,
      method: 'POST' as const,
      body: JSON.stringify({
        title: 'Benchmark Load Test Issue',
        description: 'Auto-generated issue for performance profiling',
        status: 'TODO',
        priority: 'HIGH',
      }),
      headers: { 'content-type': 'application/json' },
    },
    {
      name: 'moveIssue',
      endpoint: `/api/projects/${meta.projectId}/issues/${meta.targetIssueId}/move`,
      method: 'PATCH' as const,
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        position: 0,
      }),
      headers: { 'content-type': 'application/json' },
    },
    {
      name: 'getActivities',
      endpoint: `/api/projects/${meta.projectId}/activity?limit=20`,
      method: 'GET' as const,
    },
    {
      name: 'searchIssues',
      endpoint: `/api/projects/${meta.projectId}/issues?q=benchmark&status=TODO`,
      method: 'GET' as const,
    },
  ];

  const filteredOperations = options.targetOperation
    ? operations.filter((op) => op.name === options.targetOperation)
    : operations;

  if (filteredOperations.length === 0) {
    throw new Error(`Invalid operation specified: "${options.targetOperation}". Available: ${operations.map((o) => o.name).join(', ')}`);
  }

  const results: OperationMetrics[] = [];

  console.log(`=============================================================================`);
  console.log(` ForgeBoard Performance Benchmark Suite`);
  console.log(` Target API: ${baseUrl}`);
  console.log(` Operations: ${filteredOperations.map((o) => o.name).join(', ')}`);
  console.log(` Concurrency Levels: ${concurrencyLevels.join(', ')}`);
  console.log(` Duration: ${durationSec}s | Warm-up: ${warmupSec}s`);
  console.log(`=============================================================================\n`);

  for (let c of concurrencyLevels) {
    for (let op of filteredOperations) {
      const fullUrl = `${baseUrl}${op.endpoint}`;
      console.log(`[Run] Operation: ${op.name} | Concurrency: ${c} VUs | URL: ${op.endpoint}`);

      // 1. Warm-up run
      if (warmupSec > 0) {
        await runAutocannon({
          url: fullUrl,
          method: op.method,
          headers: {
            cookie: meta.memberCookie,
            ...op.headers,
          },
          body: op.body,
          connections: Math.min(c, 5),
          duration: warmupSec,
        });
      }

      // 2. Main measurement run
      const result = await runAutocannon({
        url: fullUrl,
        method: op.method,
        headers: {
          cookie: meta.memberCookie,
          ...op.headers,
        },
        body: op.body,
        connections: c,
        duration: durationSec,
      });

      const totalReqs = result.requests.total;
      const totalErrors = result.errors + result.timeouts;
      const errorPct = totalReqs > 0 ? (totalErrors / totalReqs) * 100 : 0;

      const statusCodes: Record<string, number> = {};
      if (result['1xx']) statusCodes['1xx'] = result['1xx'];
      if (result['2xx']) statusCodes['2xx'] = result['2xx'];
      if (result['3xx']) statusCodes['3xx'] = result['3xx'];
      if (result['4xx']) statusCodes['4xx'] = result['4xx'];
      if (result['5xx']) statusCodes['5xx'] = result['5xx'];

      const metrics: OperationMetrics = {
        endpoint: op.endpoint,
        operation: op.name,
        concurrency: c,
        requestsTotal: totalReqs,
        requestsPerSecAvg: Math.round((result.requests.average || 0) * 100) / 100,
        latencyP50Ms: result.latency.p50,
        latencyP95Ms: result.latency.p97_5 || result.latency.p99, // autocannon provides p97_5 and p99
        latencyP99Ms: result.latency.p99,
        errorsTotal: totalErrors,
        errorPercentage: Math.round(errorPct * 100) / 100,
        statusCodes,
      };

      results.push(metrics);

      console.log(
        `      ➜ RPS: ${metrics.requestsPerSecAvg} req/s | p50: ${metrics.latencyP50Ms}ms | p95: ${metrics.latencyP95Ms}ms | p99: ${metrics.latencyP99Ms}ms | Errors: ${metrics.errorsTotal} (${metrics.errorPercentage}%)\n`
      );
    }
  }

  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      database: 'PostgreSQL 16 (Local)',
      redis: 'Redis 7 (Local)',
    },
    config: {
      baseUrl,
      concurrencyLevels,
      durationSec,
      warmupSec,
    },
    results,
  };

  const reportPath = path.resolve(__dirname, '../benchmark-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[Report] Benchmark complete. Machine-readable report saved to ${reportPath}`);

  return report;
}

// Allow direct CLI execution
if (require.main === module) {
  const opArg = process.argv.find((a) => a.startsWith('--operation='))?.split('=')[1];
  const cArg = process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1];
  const durArg = process.argv.find((a) => a.startsWith('--duration='))?.split('=')[1];
  const warmArg = process.argv.find((a) => a.startsWith('--warmup='))?.split('=')[1];

  runBenchmarkSuite({
    targetOperation: opArg,
    concurrencyLevels: cArg ? cArg.split(',').map(Number) : undefined,
    durationSec: durArg ? Number(durArg) : undefined,
    warmupSec: warmArg ? Number(warmArg) : undefined,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Benchmark] Suite execution failed:', err);
      process.exit(1);
    });
}
