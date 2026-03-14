import { useMemo } from "react";
import type { SessionSummary, ViewMode } from "@/types";

interface Props {
  sessions: SessionSummary[];
  selectedId: string | null;
  onSelect: (id: string, peerId?: string) => void;
  loading: boolean;
  viewMode: ViewMode;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}

function sessionLabel(s: SessionSummary, showPeer: boolean): string {
  const date = formatDate(s.startTime);
  const branch = s.gitBranch ? `[${s.gitBranch}]` : "";
  const msg = s.firstMessage
    ? s.firstMessage.slice(0, 40) + (s.firstMessage.length > 40 ? "..." : "")
    : s.label;
  const peer = showPeer && s.peerName ? `@${s.peerName} ` : "";
  return `${date} ${peer}${branch} ${msg} (${s.eventCount})`.trim();
}

export default function SessionSelector({
  sessions,
  selectedId,
  onSelect,
  loading,
  viewMode,
}: Props) {
  const isTeam = viewMode === "team";

  const grouped = useMemo(() => {
    const groups = new Map<string, SessionSummary[]>();

    if (isTeam) {
      // Group by peer name
      for (const s of sessions) {
        const key = s.peerName || "Unknown";
        const list = groups.get(key) || [];
        list.push(s);
        groups.set(key, list);
      }
    } else {
      // Group by branch
      for (const s of sessions) {
        const key = s.gitBranch || "other";
        const list = groups.get(key) || [];
        list.push(s);
        groups.set(key, list);
      }
    }
    return groups;
  }, [sessions, isTeam]);

  if (loading) {
    return <div className="text-gray-400 text-sm px-3 py-2">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return <div className="text-gray-500 text-sm px-3 py-2">No sessions found</div>;
  }

  // Encode peerId:sessionId as value for team mode
  const encodeValue = (s: SessionSummary) =>
    isTeam ? `${s.peerId || "local"}::${s.id}` : s.id;

  const handleChange = (value: string) => {
    if (isTeam && value.includes("::")) {
      const [peerId, sessionId] = value.split("::");
      onSelect(sessionId, peerId);
    } else {
      onSelect(value);
    }
  };

  const currentValue = selectedId
    ? isTeam
      ? sessions.find((s) => s.id === selectedId)
        ? encodeValue(sessions.find((s) => s.id === selectedId)!)
        : ""
      : selectedId
    : "";

  return (
    <select
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-gray-800 text-gray-200 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 min-w-[400px] max-w-[600px]"
    >
      <option value="" disabled>
        Select a session...
      </option>
      {[...grouped.entries()].map(([group, items]) => (
        <optgroup
          key={group}
          label={isTeam ? group : `branch: ${group}`}
        >
          {items.map((s) => (
            <option key={encodeValue(s)} value={encodeValue(s)}>
              {sessionLabel(s, isTeam)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
