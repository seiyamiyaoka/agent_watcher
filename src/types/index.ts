export type EventType =
  | "team_create"
  | "agent_spawn"
  | "message_send"
  | "task_create"
  | "task_complete"
  | "task_update"
  | "file_read"
  | "file_write"
  | "bash"
  | "decision"
  | "error";

export type EventColor = "purple" | "green" | "yellow" | "blue" | "blue-light" | "red";

export interface TimelineEvent {
  id: string;
  sessionId: string;
  agentName: string;
  type: EventType;
  timestamp: string;
  summary: string;
  detail: string;
  toolName?: string;
  filePath?: string;
  taskId?: string;
  recipient?: string;
  rawContent?: string;
}

export interface Edge {
  id: string;
  sourceEventId: string;
  targetEventId: string;
  type: "message" | "task" | "file" | "spawn";
}

export interface Agent {
  name: string;
  role: string;
  sessionId: string;
  parentSessionId?: string;
}

export interface SessionSummary {
  id: string;
  projectPath: string;
  startTime: string;
  agentCount: number;
  eventCount: number;
  label: string;
  gitBranch?: string;
  firstMessage?: string;
}

export interface SessionData {
  id: string;
  agents: Agent[];
  events: TimelineEvent[];
  edges: Edge[];
  tasks: TaskInfo[];
}

export interface TaskInfo {
  id: string;
  subject: string;
  status: "pending" | "in_progress" | "completed";
  owner?: string;
}
