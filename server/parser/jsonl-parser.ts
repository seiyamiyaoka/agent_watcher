import fs from "fs";
import path from "path";
import os from "os";

export interface JsonlEntry {
  type: string;
  sessionId: string;
  timestamp: string;
  uuid?: string;
  parentUuid?: string;
  slug?: string;
  userType?: string;
  cwd?: string;
  gitBranch?: string;
  toolUseID?: string;
  parentToolUseID?: string;
  message?: {
    role?: string;
    content?: ContentBlock[] | string;
    model?: string;
    stop_reason?: string;
  };
  data?: Record<string, unknown>;
  content?: string; // queue-operation entries have top-level content
  operation?: string; // queue-operation entries
}

export interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
}

export interface SessionFile {
  id: string;
  filePath: string;
  projectPath: string;
}

const CLAUDE_DIR = path.join(os.homedir(), ".claude", "projects");

export function listSessionFiles(): SessionFile[] {
  const sessions: SessionFile[] = [];

  if (!fs.existsSync(CLAUDE_DIR)) return sessions;

  for (const projectDir of fs.readdirSync(CLAUDE_DIR)) {
    const projectPath = path.join(CLAUDE_DIR, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    for (const file of fs.readdirSync(projectPath)) {
      if (!file.endsWith(".jsonl")) continue;
      const id = file.replace(".jsonl", "");
      sessions.push({
        id,
        filePath: path.join(projectPath, file),
        projectPath: projectDir,
      });
    }
  }

  return sessions;
}

export function parseJsonlFile(filePath: string): JsonlEntry[] {
  const entries: JsonlEntry[] = [];

  if (!fs.existsSync(filePath)) return entries;

  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Parse a sub-agent output file (same JSONL format as session files).
 * These are stored at paths like /private/tmp/claude-501/.../tasks/{agentId}.output
 */
export function parseOutputFile(filePath: string): JsonlEntry[] {
  return parseJsonlFile(filePath);
}

export function getSessionMetadata(
  entries: JsonlEntry[]
): {
  startTime: string;
  endTime: string;
  slug: string;
  eventCount: number;
  gitBranch: string;
  firstMessage: string;
} {
  let startTime = "";
  let endTime = "";
  let slug = "";
  let gitBranch = "";
  let firstMessage = "";
  let eventCount = 0;

  for (const entry of entries) {
    if (entry.timestamp) {
      if (!startTime || entry.timestamp < startTime) startTime = entry.timestamp;
      if (!endTime || entry.timestamp > endTime) endTime = entry.timestamp;
    }
    if (entry.slug && !slug) slug = entry.slug;
    if (entry.gitBranch && !gitBranch) gitBranch = entry.gitBranch;
    if (entry.type === "assistant" || entry.type === "user") eventCount++;

    // Extract first user message as session description
    if (entry.type === "user" && !firstMessage) {
      const msg = entry.message;
      if (msg && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            firstMessage = block.text.replace(/\n/g, " ").slice(0, 80);
            break;
          }
        }
      }
    }
  }

  return { startTime, endTime, slug, eventCount, gitBranch, firstMessage };
}
