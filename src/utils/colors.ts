import type { EventType } from "@/types";

const EVENT_COLORS: Record<EventType, string> = {
  team_create: "#8B5CF6",
  agent_spawn: "#8B5CF6",
  message_send: "#8B5CF6",
  task_create: "#EAB308",
  task_complete: "#22C55E",
  task_update: "#EAB308",
  file_read: "#93C5FD",
  file_write: "#3B82F6",
  bash: "#3B82F6",
  decision: "#EAB308",
  error: "#EF4444",
};

export function getEventColor(type: EventType): string {
  return EVENT_COLORS[type] ?? "#6B7280";
}

export function getEventLabel(type: EventType): string {
  return type.replace(/_/g, " ");
}
