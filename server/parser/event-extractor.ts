import fs from "fs";
import type { JsonlEntry, ContentBlock } from "./jsonl-parser.js";
import { parseOutputFile } from "./jsonl-parser.js";
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

    let eventType = TOOL_TYPE_MAP[block.name];
    // Map MCP and other tools to appropriate event types
    if (!eventType) {
      if (block.name.startsWith("mcp__")) {
        // Treat MCP tool calls as bash-like external operations
        eventType = "bash";
      } else if (block.name === "ToolSearch") {
        continue; // Skip internal tool lookups
      } else {
        continue;
      }
    }

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
      // Handle MCP tools
      if (toolName.startsWith("mcp__")) {
        const parts = toolName.split("__");
        const server = parts[1] || "";
        const method = parts[2] || "";
        const arg = input.owner ? `${input.owner}/${input.repo}` : String(Object.values(input)[0] || "").slice(0, 30);
        return `${server}/${method}: ${arg}`;
      }
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

/**
 * Extract output-file path from a <task-notification> XML string.
 */
function extractOutputFilePath(content: string): string | null {
  const match = content.match(/<output-file>([^<]+)<\/output-file>/);
  return match ? match[1] : null;
}

/**
 * Extract task-id (agentId) from a <task-notification> XML string.
 */
function extractTaskId(content: string): string | null {
  const match = content.match(/<task-id>([^<]+)<\/task-id>/);
  return match ? match[1] : null;
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

  // Phase 1: Build agentId → agentName mapping from Agent tool_use blocks
  // and collect output file paths from task-notification entries
  const agentIdToName = new Map<string, string>();
  const toolUseIdToAgentName = new Map<string, string>();
  const agentOutputFiles = new Map<string, string>(); // agentId → output file path

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

  // Second pass: find agentId from tool_result responses and task-notification entries
  for (const entry of entries) {
    if (entry.type !== "user" && entry.type !== "queue-operation") continue;

    // Handle tool_result with agentId (Agent launch response)
    if (entry.type === "user" && entry.message) {
      const content = entry.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_result" && block.tool_use_id) {
            const agentName = toolUseIdToAgentName.get(block.tool_use_id);
            if (!agentName) continue;

            // Extract agentId from the result text
            const resultText = typeof block.content === "string"
              ? block.content
              : Array.isArray(block.content)
                ? block.content.map((c: ContentBlock) => c.text || "").join("")
                : "";

            const agentIdMatch = resultText.match(/agentId:\s*(\S+)/);
            if (agentIdMatch) {
              agentIdToName.set(agentIdMatch[1], agentName);
            }
          }
        }
      }

      // Handle task-notification in user message content (string format)
      const msgContent = entry.message.content;
      if (typeof msgContent === "string" && (msgContent as string).includes("<task-notification>")) {
        const taskId = extractTaskId(msgContent as string);
        const outputFile = extractOutputFilePath(msgContent as string);
        if (taskId && outputFile) {
          agentOutputFiles.set(taskId, outputFile);
        }
      }
    }

    // Handle queue-operation with task-notification
    if (entry.type === "queue-operation") {
      const content = entry.content || "";
      if (content.includes("<task-notification>")) {
        const taskId = extractTaskId(content);
        const outputFile = extractOutputFilePath(content);
        if (taskId && outputFile) {
          agentOutputFiles.set(taskId, outputFile);
        }
      }
    }
  }

  // Also check progress entries for agentId mapping (legacy format)
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

  // Phase 2: Extract events from main session entries (lead agent events)
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

  // Phase 3: Parse sub-agent output files and extract their events
  for (const [agentId, outputFilePath] of agentOutputFiles) {
    const agentName = agentIdToName.get(agentId);
    if (!agentName) continue;

    // Register agent if not yet registered
    if (!agentMap.has(agentName)) {
      agentMap.set(agentName, {
        name: agentName,
        role: "general-purpose",
        sessionId: agentId,
        parentSessionId: mainSessionId,
      });
    }

    // Read and parse the output file
    if (!fs.existsSync(outputFilePath)) continue;

    const subEntries = parseOutputFile(outputFilePath);
    for (const subEntry of subEntries) {
      if (subEntry.type === "assistant") {
        const syntheticEntry: JsonlEntry = {
          type: subEntry.type,
          sessionId: agentId,
          timestamp: subEntry.timestamp,
          message: subEntry.message,
        };
        const toolEvents = extractToolEvents(syntheticEntry, agentName);
        events.push(...toolEvents);
        events.push(...extractTextDecisions(syntheticEntry, agentName));
      }

      if (subEntry.type === "user") {
        const syntheticEntry: JsonlEntry = {
          type: subEntry.type,
          sessionId: agentId,
          timestamp: subEntry.timestamp,
          message: subEntry.message,
        };
        events.push(...extractErrorEvents(syntheticEntry, agentName));
      }
    }
  }

  // Sort all events by timestamp
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

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
