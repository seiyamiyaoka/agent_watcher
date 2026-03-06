import type { TimelineEvent, Edge } from "../../src/types/index.js";

let edgeCounter = 0;
function nextEdgeId(): string {
  return `edge-${++edgeCounter}`;
}

export function buildEdges(events: TimelineEvent[]): Edge[] {
  edgeCounter = 0;
  const edges: Edge[] = [];

  // Index events by various properties for quick lookup
  const taskCreateEvents = new Map<string, TimelineEvent>();
  const fileWriteEvents = new Map<string, TimelineEvent[]>();
  const fileReadEvents = new Map<string, TimelineEvent[]>();
  const agentSpawnEvents = new Map<string, TimelineEvent>();

  for (const evt of events) {
    // Index task creates
    if (evt.type === "task_create" && evt.taskId) {
      taskCreateEvents.set(evt.taskId, evt);
    }

    // Index file operations
    if (evt.filePath) {
      if (evt.type === "file_write") {
        const list = fileWriteEvents.get(evt.filePath) || [];
        list.push(evt);
        fileWriteEvents.set(evt.filePath, list);
      }
      if (evt.type === "file_read") {
        const list = fileReadEvents.get(evt.filePath) || [];
        list.push(evt);
        fileReadEvents.set(evt.filePath, list);
      }
    }

    // Index agent spawns
    if (evt.type === "agent_spawn") {
      try {
        const input = JSON.parse(evt.detail);
        const name = input.name || "";
        if (name) agentSpawnEvents.set(name, evt);
      } catch {
        // skip
      }
    }
  }

  // 1. SendMessage edges: from sender to recipient's next event
  for (const evt of events) {
    if (evt.type === "message_send" && evt.recipient) {
      // Find the first event from the recipient after this message
      const recipientEvent = events.find(
        (e) =>
          e.agentName === evt.recipient &&
          e.timestamp >= evt.timestamp &&
          e.id !== evt.id
      );
      if (recipientEvent) {
        edges.push({
          id: nextEdgeId(),
          sourceEventId: evt.id,
          targetEventId: recipientEvent.id,
          type: "message",
        });
      }
    }
  }

  // 2. TaskUpdate -> TaskCreate edges
  for (const evt of events) {
    if (
      (evt.type === "task_complete" || evt.type === "task_update") &&
      evt.taskId
    ) {
      const createEvt = taskCreateEvents.get(evt.taskId);
      if (createEvt) {
        edges.push({
          id: nextEdgeId(),
          sourceEventId: createEvt.id,
          targetEventId: evt.id,
          type: "task",
        });
      }
    }
  }

  // 3. File read -> write edges (same file, read before write)
  for (const [filePath, writes] of fileWriteEvents) {
    const reads = fileReadEvents.get(filePath);
    if (!reads) continue;

    for (const writeEvt of writes) {
      // Find the closest read before this write
      let closestRead: TimelineEvent | null = null;
      for (const readEvt of reads) {
        if (readEvt.timestamp <= writeEvt.timestamp) {
          if (
            !closestRead ||
            readEvt.timestamp > closestRead.timestamp
          ) {
            closestRead = readEvt;
          }
        }
      }
      if (closestRead) {
        edges.push({
          id: nextEdgeId(),
          sourceEventId: closestRead.id,
          targetEventId: writeEvt.id,
          type: "file",
        });
      }
    }
  }

  // 4. Agent spawn -> first event of spawned agent
  for (const [agentName, spawnEvt] of agentSpawnEvents) {
    const firstAgentEvent = events.find(
      (e) => e.agentName === agentName && e.id !== spawnEvt.id
    );
    if (firstAgentEvent) {
      edges.push({
        id: nextEdgeId(),
        sourceEventId: spawnEvt.id,
        targetEventId: firstAgentEvent.id,
        type: "spawn",
      });
    }
  }

  return edges;
}
