import Bonjour, { type Service } from "bonjour-service";
import type { PeerConfig } from "./config.js";

export interface PeerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  status: "online" | "offline" | "error";
  lastSeen: string;
}

const SERVICE_TYPE = "agent-timeline";
const HEALTH_CHECK_INTERVAL = 10_000;

export class PeerDiscovery {
  private peers = new Map<string, PeerInfo>();
  private bonjour: InstanceType<typeof Bonjour> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private config: PeerConfig;
  private localId: string;

  constructor(config: PeerConfig) {
    this.config = config;
    this.localId = `${config.name}-${config.port}`;

    // Add self
    this.peers.set(this.localId, {
      id: this.localId,
      name: config.name,
      host: "localhost",
      port: config.port,
      status: "online",
      lastSeen: new Date().toISOString(),
    });
  }

  start(): void {
    // Add manual peers from config
    for (const manual of this.config.peers) {
      const id = `${manual.host}:${manual.port}`;
      if (!this.peers.has(id)) {
        this.peers.set(id, {
          id,
          name: id,
          host: manual.host,
          port: manual.port,
          status: "offline",
          lastSeen: "",
        });
      }
    }

    // mDNS discovery
    if (this.config.enableMdns) {
      this.startMdns();
    }

    // Health check loop
    this.healthTimer = setInterval(() => this.healthCheckAll(), HEALTH_CHECK_INTERVAL);
    // Initial health check for manual peers
    this.healthCheckAll();
  }

  stop(): void {
    if (this.bonjour) {
      this.bonjour.unpublishAll();
      this.bonjour.destroy();
      this.bonjour = null;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  getLocalId(): string {
    return this.localId;
  }

  getRemotePeers(): PeerInfo[] {
    return this.getPeers().filter((p) => p.id !== this.localId && p.status === "online");
  }

  private startMdns(): void {
    try {
      this.bonjour = new Bonjour();

      // Advertise this server
      this.bonjour.publish({
        name: this.config.name,
        type: SERVICE_TYPE,
        port: this.config.port,
        txt: { name: this.config.name },
      });

      // Browse for other servers
      const browser = this.bonjour.find({ type: SERVICE_TYPE });

      browser.on("up", (service: Service) => {
        this.addFromService(service);
      });

      browser.on("down", (service: Service) => {
        const id = this.serviceId(service);
        const peer = this.peers.get(id);
        if (peer && id !== this.localId) {
          peer.status = "offline";
        }
      });

      console.log(`mDNS: advertising as "${this.config.name}" on port ${this.config.port}`);
    } catch (err) {
      console.error("mDNS initialization failed:", err);
    }
  }

  private addFromService(service: Service): void {
    const id = this.serviceId(service);
    if (id === this.localId) return;

    const host = service.host || service.referer?.address || "localhost";
    const name = service.txt?.name || service.name || id;

    this.peers.set(id, {
      id,
      name: typeof name === "string" ? name : id,
      host,
      port: service.port,
      status: "online",
      lastSeen: new Date().toISOString(),
    });

    console.log(`mDNS: discovered peer "${name}" at ${host}:${service.port}`);
  }

  private serviceId(service: Service): string {
    return `${service.txt?.name || service.name}-${service.port}`;
  }

  private async healthCheckAll(): Promise<void> {
    const checks = this.getPeers()
      .filter((p) => p.id !== this.localId)
      .map((p) => this.healthCheck(p));
    await Promise.allSettled(checks);
  }

  private async healthCheck(peer: PeerInfo): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`http://${peer.host}:${peer.port}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        peer.status = "online";
        peer.lastSeen = new Date().toISOString();

        // Try to get identity for name
        try {
          const identityRes = await fetch(
            `http://${peer.host}:${peer.port}/api/identity`,
          );
          if (identityRes.ok) {
            const identity = await identityRes.json();
            if (identity.name) peer.name = identity.name;
          }
        } catch {
          // Identity endpoint is optional
        }
      } else {
        peer.status = "error";
      }
    } catch {
      peer.status = "offline";
    }
  }
}
