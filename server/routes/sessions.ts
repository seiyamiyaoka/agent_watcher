import { Router, type Request, type Response } from "express";
import {
  listSessionFiles,
  parseJsonlFile,
  getSessionMetadata,
} from "../parser/jsonl-parser.js";
import { extractEvents } from "../parser/event-extractor.js";
import { buildEdges } from "../parser/edge-builder.js";
import type { SessionSummary, SessionData } from "../../src/types/index.js";

const router = Router();

/**
 * GET /api/sessions
 * List all discovered sessions with summary metadata.
 */
router.get("/", (_req: Request, res: Response) => {
  try {
    const files = listSessionFiles();
    const summaries: SessionSummary[] = [];

    for (const file of files) {
      const entries = parseJsonlFile(file.filePath);
      if (entries.length === 0) continue;

      const meta = getSessionMetadata(entries);

      // Skip very small sessions (subagent stubs, etc.)
      if (meta.eventCount < 5) continue;

      summaries.push({
        id: file.id,
        projectPath: file.projectPath,
        startTime: meta.startTime,
        agentCount: 1,
        eventCount: meta.eventCount,
        label: meta.slug || file.id.slice(0, 8),
        gitBranch: meta.gitBranch,
        firstMessage: meta.firstMessage,
        peerId: "local",
        peerName: "local",
      });
    }

    // Sort by start time descending (newest first)
    summaries.sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return b.startTime.localeCompare(a.startTime);
    });

    res.json(summaries);
  } catch (err) {
    console.error("Error listing sessions:", err);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

/**
 * GET /api/sessions/:id
 * Get full session data with events, agents, edges, and tasks.
 */
router.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const files = listSessionFiles();
    const file = files.find((f) => f.id === id);

    if (!file) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const entries = parseJsonlFile(file.filePath);
    const { events, agents, tasks } = extractEvents(entries);
    const edges = buildEdges(events);

    const sessionData: SessionData = {
      id,
      agents,
      events,
      edges,
      tasks,
    };

    res.json(sessionData);
  } catch (err) {
    console.error("Error loading session:", err);
    res.status(500).json({ error: "Failed to load session" });
  }
});

export default router;
