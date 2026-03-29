import type { WebSocket } from "ws";

export interface TrackedConnection {
  ws: WebSocket;
  connectedAt: number;
}

export class ConnectionTracker {
  private connections = new Map<WebSocket, TrackedConnection>();

  addConnection(ws: WebSocket): void {
    const tracked: TrackedConnection = {
      ws,
      connectedAt: Date.now(),
    };
    this.connections.set(ws, tracked);

    ws.on("close", () => {
      this.removeConnection(ws);
    });
  }

  removeConnection(ws: WebSocket): void {
    this.connections.delete(ws);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getAllConnections(): ReadonlyMap<WebSocket, TrackedConnection> {
    return this.connections;
  }
}
