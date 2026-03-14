import { Router, type Request, type Response } from "express";
import type { PeerDiscovery } from "../peer/discovery.js";
import type { PeerConfig } from "../peer/config.js";
import type { SessionSummary, SessionData } from "../../src/types/index.js";

const PROXY_TIMEOUT = 5000;

export function createPeersRouter(discovery: PeerDiscovery, config: PeerConfig): Router {
  const router = Router();

  /**
   * GET /api/identity
   * Returns this server's identity info.
   */
  router.get("/identity", (_req: Request, res: Response) => {
    res.json({
      id: discovery.getLocalId(),
      name: config.name,
      port: config.port,
    });
  });

  /**
   * GET /api/peers
   * Returns all discovered peers (including self).
   */
  router.get("/", (_req: Request, res: Response) => {
    res.json(discovery.getPeers());
  });

  /**
   * GET /api/peers/sessions
   * Aggregates sessions from all peers (including local).
   */
  router.get("/sessions", async (_req: Request, res: Response) => {
    try {
      const peers = discovery.getPeers();
      const localId = discovery.getLocalId();

      const results = await Promise.allSettled(
        peers.map(async (peer) => {
          if (peer.id === localId) {
            // Fetch from own server
            const localRes = await fetch(
              `http://localhost:${config.port}/api/sessions`,
            );
            const sessions: SessionSummary[] = await localRes.json();
            return sessions.map((s) => ({
              ...s,
              peerId: localId,
              peerName: config.name,
            }));
          }

          if (peer.status !== "online") return [];

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT);
          try {
            const peerRes = await fetch(
              `http://${peer.host}:${peer.port}/api/sessions`,
              { signal: controller.signal },
            );
            clearTimeout(timeout);
            const sessions: SessionSummary[] = await peerRes.json();
            return sessions.map((s) => ({
              ...s,
              peerId: peer.id,
              peerName: peer.name,
            }));
          } catch {
            clearTimeout(timeout);
            return [];
          }
        }),
      );

      const allSessions = results.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      );

      // Sort by start time descending
      allSessions.sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return b.startTime.localeCompare(a.startTime);
      });

      res.json(allSessions);
    } catch (err) {
      console.error("Error aggregating peer sessions:", err);
      res.status(500).json({ error: "Failed to aggregate sessions" });
    }
  });

  /**
   * GET /api/peers/:peerId/sessions/:sessionId
   * Proxies a session detail request to a specific peer.
   */
  router.get("/:peerId/sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      const { peerId, sessionId } = req.params;
      const localId = discovery.getLocalId();

      // If local, redirect to local endpoint
      if (peerId === localId) {
        const localRes = await fetch(
          `http://localhost:${config.port}/api/sessions/${sessionId}`,
        );
        const data: SessionData = await localRes.json();
        res.json(data);
        return;
      }

      const peer = discovery.getPeers().find((p) => p.id === peerId);
      if (!peer) {
        res.status(404).json({ error: "Peer not found" });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT);

      try {
        const peerRes = await fetch(
          `http://${peer.host}:${peer.port}/api/sessions/${sessionId}`,
          { signal: controller.signal },
        );
        clearTimeout(timeout);
        const data: SessionData = await peerRes.json();
        res.json(data);
      } catch {
        clearTimeout(timeout);
        res.status(502).json({ error: "Failed to reach peer" });
      }
    } catch (err) {
      console.error("Error proxying session:", err);
      res.status(500).json({ error: "Failed to proxy session" });
    }
  });

  return router;
}
