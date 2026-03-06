import type { JsonlEntry, ContentBlock } from "./jsonl-parser.js";
import type { TimelineEvent, EventType, Agent, TaskInfo } from "../../src/types/index.js";

let eventCounter = 0;
function nextId(): string {
  return `evt-${++eventCounter}`;
}

const TOOL_TYPE_MAP: Record<string, EventType> = {
  TeamCreate: "team_create",
  Agent: "agent_spawn",
  SendMessage: "message_send",
  TaskCreate: "task_create",
  TaskUpdate: "task_update",
  Read: "file_read",
  Grep: "file_read",
  Glob: "file_read",
  Write: "file_write",
  Edit: "file_write",
  Bash: "bash",
  AskUserQuestion: "decision",
  ExitPlanMode: "decision",
};

function extractToolEvents(
  entry: JsonlEntry,
  agentName: string
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const msg = entry.message;
  if (!msg || !Array.isArray(msg.content)) return events;

  for (const block of msg.content) {
    if (block.type !== "tool_use" || !block.name) continue;

    const eventType = TOOL_TYPE_MAP[block.name];
    if (!eventType) continue;

    const input = block.input || {};
    const event: TimelineEvent = {
      id: nextId(),
      sessionId: entry.sessionId,
      agentName,
      type: eventType,
      timestamp: entry.timestamp,
      summary: buildSummary(block.name, input),
      detail: JSON.stringify(input, null, 2),
      toolName: block.name,
    };

    // Extract file path
    if (input.file_path) event.filePath = String(input.file_path);
    if (input.path) event.filePath = String(input.path);
    if (input.pattern) event.filePath = String(input.pattern);

    // Extract task-related info
    if (input.taskId) event.taskId = String(input.taskId);
    if (input.subject) event.summary = String(input.subject);

    // Extract message recipient
    if (input.recipient) event.recipient = String(input.recipient);

    // Mark task completions
    if (block.name === "TaskUpdate" && input.status === "completed") {
      event.type = "task_complete";
    }

    events.push(event);
  }

  return events;
}

function buildSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "TeamCreate":
      return `Team: ${input.team_name || "unknown"}`;
    case "Agent":
      return `Spawn: ${input.name || input.subagent_type || "agent"}`;
    case "SendMessage":
      return `→ ${input.recipient || "?"}: ${String(input.summary || input.content || "").slice(0, 50)}`;
    case "TaskCreate":
      return `Task: ${String(input.subject || "").slice(0, 50)}`;
    case "TaskUpdate":
      return `Task #${input.taskId}: ${input.status || "update"}`;
    case "Read":
      return `Read: ${shortenPath(String(input.file_path || ""))}`;
    case "Write":
      return `Write: ${shortenPath(String(input.file_path || ""))}`;
    case "Edit":
      return `Edit: ${shortenPath(String(input.file_path || ""))}`;
    case "Grep":
      return `Grep: ${String(input.pattern || "").slice(0, 30)}`;
    case "Glob":
      return `Glob: ${String(input.pattern || "").slice(0, 30)}`;
    case "Bash":
      return `$ ${String(input.command || "").slice(0, 50)}`;
    case "AskUserQuestion":
      return "Question to user";
    case "ExitPlanMode":
      return "Plan ready";
    default:
      return toolName;
  }
}

function shortenPath(p: string): string {
  const parts = p.split("/");
  return parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : p;
}

function extractTextDecisions(entry: JsonlEntry, agentName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const msg = entry.message;
  if (!msg || !Array.isArray(msg.content)) return events;

  // Check if this entry has only text blocks (no tool_use) - potential decision point
  const hasToolUse = msg.content.some(
    (b: ContentBlock) => b.type === "tool_use"
  );
  if (hasToolUse) return events;

  const textBlocks = msg.content.filter(
    (b: ContentBlock) => b.type === "text" && b.text
  );
  if (textBlocks.length === 0) return events;

  const text = textBlocks.map((b: ContentBlock) => b.text || "").join("\n");

  // Only extract as decision if text is substantial (not just a brief status update)
  if (text.length < 100) return events;

  // Look for decision-like content
  const isDecision =
    text.includes("?") ||
    text.includes("approach") ||
    text.includes("strategy") ||
    text.includes("判断") ||
    text.includes("方針") ||
    text.includes("検討");

  if (!isDecision) return events;

  events.push({
    id: nextId(),
    sessionId: entry.sessionId,
    agentName,
    type: "decision",
    timestamp: entry.timestamp,
    summary: text.slice(0, 80).replace(/\n/g, " "),
    detail: text,
  });

  return events;
}

function extractErrorEvents(entry: JsonlEntry, agentName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const msg = entry.message;
  if (!msg || !Array.isArray(msg.content)) return events;

  for (const block of msg.content) {
    if (block.type !== "tool_result") continue;

    const content = typeof block.content === "string"
      ? block.content
      : Array.isArray(block.content)
        ? block.content.map((c: ContentBlock) => c.text || "").join("")
        : "";

    if (
      content.includes("Error") ||
      content.includes("error") ||
      content.includes("FAILED") ||
      content.includes("failed")
    ) {
      // Check if it's a real error, not just a mention
      const isRealError =
        content.includes("Error:") ||
        content.includes("error:") ||
        content.includes("FAILED") ||
        content.includes("Exit code 1") ||
        content.includes("Exit code 2");

      if (isRealError) {
        events.push({
          id: nextId(),
          sessionId: entry.sessionId,
          agentName,
          type: "error",
          timestamp: entry.timestamp,
          summary: `Error: ${content.slice(0, 80)}`,
          detail: content.slice(0, 2000),
        });
      }
    }
  }

  return events;
}

/** Extract the message object from either a top-level entry or a progress entry */
function getMessageFromEntry(entry: JsonlEntry): { type: string; message?: JsonlEntry["message"]; timestamp: string } | null {
  // Top-level assistant/user entry
  if (entry.type === "assistant" || entry.type === "user") {
    return { type: entry.type, message: entry.message, timestamp: entry.timestamp };
  }
  // Progress entry wrapping a sub-agent message
  if (entry.type === "progress" && entry.data) {
    const data = entry.data as Record<string, unknown>;
    const innerMsg = data.message as Record<string, unknown> | undefined;
    if (innerMsg && innerMsg.type) {
      const msgType = String(innerMsg.type); // "assistant" or "user"
      const innerMessage = innerMsg.message as JsonlEntry["message"] | undefined;
      const ts = String(innerMsg.timestamp || entry.timestamp);
      return { type: msgType, message: innerMessage, timestamp: ts };
    }
  }
  return null;
}

/** Resolve agent name from a progress entry's agentId, or "lead" for top-level entries */
function resolveAgentName(
  entry: JsonlEntry,
  agentIdToName: Map<string, string>
): string {
  if (entry.type === "progress" && entry.data) {
    const data = entry.data as Record<string, unknown>;
    const agentId = data.agentId as string | undefined;
    if (agentId && agentIdToName.has(agentId)) {
      return agentIdToName.get(agentId)!;
    }
  }
  return "lead";
}

export interface ExtractionResult {
  events: TimelineEvent[];
  agents: Agent[];
  tasks: TaskInfo[];
}

export function extractEvents(entries: JsonlEntry[]): ExtractionResult {
  eventCounter = 0;
  const events: TimelineEvent[] = [];
  const agentMap = new Map<string, Agent>();
  const taskMap = new Map<string, TaskInfo>();

  // Default lead agent
  const mainSessionId = entries[0]?.sessionId || "unknown";
  agentMap.set("lead", {
    name: "lead",
    role: "lead",
    sessionId: mainSessionId,
  });

  // Phase 1: Build agentId → agentName mapping by scanning Agent tool_use blocks
  // The Agent tool_use has input.name, and the progress entries have data.agentId
  // We need to find: Agent tool_use (with parentToolUseID) → first progress entry with that parentToolUseID → agentId
  const agentIdToName = new Map<string, string>();
  const toolUseIdToAgentName = new Map<string, string>();

  // First pass: find Agent tool_use blocks and extract name
  for (const entry of entries) {
    const resolved = getMessageFromEntry(entry);
    if (!resolved || resolved.type !== "assistant") continue;

    const msg = resolved.message;
    if (!msg || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (block.type === "tool_use" && block.name === "Agent" && block.id) {
        const input = block.input || {};
        const name = String(input.name || input.subagent_type || `agent-${toolUseIdToAgentName.size}`);
        toolUseIdToAgentName.set(block.id, name);
      }
    }
  }

  // Second pass: find progress entries and map agentId to name
  // Progress entries have parentToolUseID that links to the Agent tool_use
  for (const entry of entries) {
    if (entry.type !== "progress" || !entry.data) continue;
    const data = entry.data as Record<string, unknown>;
    const agentId = data.agentId as string | undefined;
    const parentToolUseID = entry.parentToolUseID;

    if (agentId && parentToolUseID && toolUseIdToAgentName.has(parentToolUseID)) {
      const name = toolUseIdToAgentName.get(parentToolUseID)!;
      if (!agentIdToName.has(agentId)) {
        agentIdToName.set(agentId, name);
      }
    }
  }

  // Phase 2: Extract events from all entries
  for (const entry of entries) {
    const resolved = getMessageFromEntry(entry);
    if (!resolved) continue;

    const agentName = resolveAgentName(entry, agentIdToName);

    // Register agent if new
    if (agentName !== "lead" && !agentMap.has(agentName)) {
      agentMap.set(agentName, {
        name: agentName,
        role: "general-purpose",
        sessionId: entry.sessionId,
        parentSessionId: mainSessionId,
      });
    }

    // Build a synthetic entry-like object for the extraction functions
    const syntheticEntry: JsonlEntry = {
      type: resolved.type,
      sessionId: entry.sessionId,
      timestamp: resolved.timestamp,
      message: resolved.message,
    };

    if (resolved.type === "assistant") {
      const toolEvents = extractToolEvents(syntheticEntry, agentName);
      events.push(...toolEvents);

      // Track agent spawns (for lead's Agent calls)
      for (const evt of toolEvents) {
        if (evt.type === "agent_spawn" && evt.toolName === "Agent") {
          try {
            const input = JSON.parse(evt.detail);
            const name = input.name || input.subagent_type || `agent-${agentMap.size}`;
            if (!agentMap.has(name)) {
              agentMap.set(name, {
                name,
                role: input.subagent_type || "general-purpose",
                sessionId: entry.sessionId,
                parentSessionId: mainSessionId,
              });
            }
          } catch {
            // skip
          }
        }
      }

      // Extract decision events
      events.push(...extractTextDecisions(syntheticEntry, agentName));
    }

    if (resolved.type === "user") {
      // Extract errors from tool results
      events.push(...extractErrorEvents(syntheticEntry, agentName));
    }
  }

  // Extract tasks from TaskCreate/TaskUpdate events
  for (const evt of events) {
    if (evt.type === "task_create" && evt.toolName === "TaskCreate") {
      try {
        const input = JSON.parse(evt.detail);
        const id = evt.taskId || `task-${taskMap.size + 1}`;
        taskMap.set(id, {
          id,
          subject: input.subject || "Unknown task",
          status: "pending",
          owner: input.owner,
        });
      } catch {
        // skip
      }
    }
    if (
      (evt.type === "task_complete" || evt.type === "task_update") &&
      evt.taskId
    ) {
      const task = taskMap.get(evt.taskId);
      if (task) {
        try {
          const input = JSON.parse(evt.detail);
          if (input.status) task.status = input.status;
          if (input.owner) task.owner = input.owner;
        } catch {
          // skip
        }
      }
    }
  }

  return {
    events,
    agents: Array.from(agentMap.values()),
    tasks: Array.from(taskMap.values()),
  };
}
