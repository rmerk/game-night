import type { WebSocket } from "ws";

export interface TrackedConnection {
  ws: WebSocket;
  ip: string;
  connectedAt: number;
}

export interface ConnectionTrackerOptions {
  maxConnectionsPerIp?: number;
}

const DEFAULT_MAX_CONNECTIONS_PER_IP = 10;

export class ConnectionTracker {
  private connections = new Map<WebSocket, TrackedConnection>();
  private ipCounts = new Map<string, number>();
  private maxConnectionsPerIp: number;

  constructor(options: ConnectionTrackerOptions = {}) {
    this.maxConnectionsPerIp = options.maxConnectionsPerIp ?? DEFAULT_MAX_CONNECTIONS_PER_IP;
  }

  canConnect(ip: string): boolean {
    return (this.ipCounts.get(ip) ?? 0) < this.maxConnectionsPerIp;
  }

  addConnection(ws: WebSocket, ip: string): void {
    const tracked: TrackedConnection = {
      ws,
      ip,
      connectedAt: Date.now(),
    };
    this.connections.set(ws, tracked);
    this.ipCounts.set(ip, (this.ipCounts.get(ip) ?? 0) + 1);

    ws.on("close", () => {
      this.removeConnection(ws);
    });
  }

  removeConnection(ws: WebSocket): void {
    const tracked = this.connections.get(ws);
    if (tracked) {
      const count = (this.ipCounts.get(tracked.ip) ?? 1) - 1;
      if (count <= 0) {
        this.ipCounts.delete(tracked.ip);
      } else {
        this.ipCounts.set(tracked.ip, count);
      }
    }
    this.connections.delete(ws);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionCountByIp(ip: string): number {
    return this.ipCounts.get(ip) ?? 0;
  }

  getAllConnections(): ReadonlyMap<WebSocket, TrackedConnection> {
    return this.connections;
  }
}
