import type { EventType } from "@/types";

/**
 * Agent name/role to emoji mapping.
 * Assigns a consistent avatar based on role keywords in the agent name.
 */
const ROLE_EMOJIS: [RegExp, string][] = [
  [/lead|main|primary/i, "\u{1F9D1}\u200D\u{1F4BB}"], // person at computer
  [/developer|dev/i, "\u{1F477}"],                       // construction worker
  [/review/i, "\u{1F9D0}"],                              // monocle face
  [/security/i, "\u{1F6E1}\uFE0F"],                      // shield
  [/design/i, "\u{1F3A8}"],                               // palette
  [/qa|test/i, "\u{1F9EA}"],                              // test tube
  [/research/i, "\u{1F4DA}"],                             // books
  [/business/i, "\u{1F4BC}"],                             // briefcase
];

const FALLBACK_EMOJIS = [
  "\u{1F916}", // robot
  "\u{1F47E}", // alien monster
  "\u{1F680}", // rocket
  "\u{1F525}", // fire
  "\u{26A1}",  // lightning
  "\u{1F308}", // rainbow
  "\u{2B50}",  // star
  "\u{1F48E}", // gem
];

const agentEmojiCache = new Map<string, string>();

export function getAgentEmoji(agentName: string): string {
  const cached = agentEmojiCache.get(agentName);
  if (cached) return cached;

  for (const [pattern, emoji] of ROLE_EMOJIS) {
    if (pattern.test(agentName)) {
      agentEmojiCache.set(agentName, emoji);
      return emoji;
    }
  }

  // Deterministic fallback based on name hash
  let hash = 0;
  for (let i = 0; i < agentName.length; i++) {
    hash = (hash * 31 + agentName.charCodeAt(i)) | 0;
  }
  const emoji = FALLBACK_EMOJIS[Math.abs(hash) % FALLBACK_EMOJIS.length];
  agentEmojiCache.set(agentName, emoji);
  return emoji;
}

/**
 * Event type to small inline emoji for speech bubbles.
 */
const EVENT_EMOJIS: Record<EventType, string> = {
  team_create: "\u{1F91D}",    // handshake
  agent_spawn: "\u{1F680}",    // rocket
  message_send: "\u{1F4AC}",   // speech bubble
  task_create: "\u{1F4CB}",    // clipboard
  task_complete: "\u2705",      // check mark
  task_update: "\u{1F504}",    // arrows circle
  file_read: "\u{1F4D6}",     // open book
  file_write: "\u270F\uFE0F", // pencil
  bash: "\u{1F4BB}",           // laptop
  decision: "\u{1F914}",       // thinking
  error: "\u274C",              // cross mark
};

export function getEventEmoji(type: EventType): string {
  return EVENT_EMOJIS[type] ?? "\u2754"; // question mark fallback
}
