export interface MetricsSnapshot {
  uptimeSeconds: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  http: {
    totalRequests: number;
    activeRequests: number;
    totalErrors: number;
    statusCodes: Record<string, number>;
    latency: {
      avgMs: number;
      minMs: number;
      maxMs: number;
      p95Ms: number;
    };
  };
  socket: {
    connectedClients: number;
  };
}

class MetricsCollector {
  private totalRequests = 0;
  private activeRequests = 0;
  private totalErrors = 0;
  private statusCodes: Record<string, number> = {};
  private connectedSockets = 0;
  private latencySamples: number[] = [];
  private readonly maxSamples = 1000;

  incrementRequests(): void {
    this.totalRequests++;
    this.activeRequests++;
  }

  decrementActiveRequests(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
  }

  recordRequest(statusCode: number, durationMs: number): void {
    this.recordStatusCode(statusCode);
    if (statusCode >= 400) {
      this.totalErrors++;
    }

    this.latencySamples.push(durationMs);
    if (this.latencySamples.length > this.maxSamples) {
      this.latencySamples.shift();
    }
  }

  recordStatusCode(statusCode: number): void {
    const bucket = `${Math.floor(statusCode / 100)}xx`;
    this.statusCodes[bucket] = (this.statusCodes[bucket] || 0) + 1;
    this.statusCodes[String(statusCode)] = (this.statusCodes[String(statusCode)] || 0) + 1;
  }

  setConnectedSockets(count: number): void {
    this.connectedSockets = count;
  }

  incrementConnectedSockets(): void {
    this.connectedSockets++;
  }

  decrementConnectedSockets(): void {
    if (this.connectedSockets > 0) {
      this.connectedSockets--;
    }
  }

  private calculateLatencyStats() {
    if (this.latencySamples.length === 0) {
      return { avgMs: 0, minMs: 0, maxMs: 0, p95Ms: 0 };
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avgMs = Math.round((sum / sorted.length) * 100) / 100;
    const minMs = sorted[0];
    const maxMs = sorted[sorted.length - 1];
    const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
    const p95Ms = sorted[p95Index];

    return { avgMs, minMs, maxMs, p95Ms };
  }

  getSnapshot(): MetricsSnapshot {
    const mem = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    return {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: {
        rss: toMb(mem.rss),
        heapTotal: toMb(mem.heapTotal),
        heapUsed: toMb(mem.heapUsed),
        external: toMb(mem.external),
      },
      http: {
        totalRequests: this.totalRequests,
        activeRequests: this.activeRequests,
        totalErrors: this.totalErrors,
        statusCodes: { ...this.statusCodes },
        latency: this.calculateLatencyStats(),
      },
      socket: {
        connectedClients: this.connectedSockets,
      },
    };
  }

  /**
   * Returns Prometheus-compatible text exposition format.
   */
  toPrometheusFormat(): string {
    const snapshot = this.getSnapshot();
    const lines: string[] = [
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${snapshot.uptimeSeconds}`,
      '',
      '# HELP nodejs_memory_heap_used_bytes Process heap memory used in bytes',
      '# TYPE nodejs_memory_heap_used_bytes gauge',
      `nodejs_memory_heap_used_bytes ${process.memoryUsage().heapUsed}`,
      '',
      '# HELP http_requests_total Total number of HTTP requests processed',
      '# TYPE http_requests_total counter',
      `http_requests_total ${snapshot.http.totalRequests}`,
      '',
      '# HELP http_errors_total Total number of HTTP client and server error responses',
      '# TYPE http_errors_total counter',
      `http_errors_total ${snapshot.http.totalErrors}`,
      '',
      '# HELP http_requests_active Current active in-flight HTTP requests',
      '# TYPE http_requests_active gauge',
      `http_requests_active ${snapshot.http.activeRequests}`,
      '',
      '# HELP http_request_duration_milliseconds_avg Average HTTP request latency in milliseconds',
      '# TYPE http_request_duration_milliseconds_avg gauge',
      `http_request_duration_milliseconds_avg ${snapshot.http.latency.avgMs}`,
      '',
      '# HELP http_request_duration_milliseconds_p95 95th percentile HTTP request latency in milliseconds',
      '# TYPE http_request_duration_milliseconds_p95 gauge',
      `http_request_duration_milliseconds_p95 ${snapshot.http.latency.p95Ms}`,
      '',
      '# HELP socketio_connected_clients Current connected Socket.IO clients',
      '# TYPE socketio_connected_clients gauge',
      `socketio_connected_clients ${snapshot.socket.connectedClients}`,
    ];

    for (const [code, count] of Object.entries(snapshot.http.statusCodes)) {
      if (code.endsWith('xx')) {
        lines.push(`http_requests_by_class_total{class="${code}"} ${count}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}

export const metrics = new MetricsCollector();
export default metrics;
