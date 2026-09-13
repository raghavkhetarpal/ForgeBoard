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
    statusCodes: Record<string, number>;
  };
  socket: {
    connectedClients: number;
  };
}

class MetricsCollector {
  private totalRequests = 0;
  private activeRequests = 0;
  private statusCodes: Record<string, number> = {};
  private connectedSockets = 0;

  incrementRequests(): void {
    this.totalRequests++;
    this.activeRequests++;
  }

  decrementActiveRequests(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
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
        statusCodes: { ...this.statusCodes },
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
      '# HELP http_requests_active Current active in-flight HTTP requests',
      '# TYPE http_requests_active gauge',
      `http_requests_active ${snapshot.http.activeRequests}`,
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
