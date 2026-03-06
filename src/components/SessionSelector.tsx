import { useMemo } from "react";
import type { SessionSummary } from "@/types";

interface Props {
  sessions: SessionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
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

function sessionLabel(s: SessionSummary): string {
  const date = formatDate(s.startTime);
  const branch = s.gitBranch ? `[${s.gitBranch}]` : "";
  const msg = s.firstMessage
    ? s.firstMessage.slice(0, 40) + (s.firstMessage.length > 40 ? "..." : "")
    : s.label;
  return `${date} ${branch} ${msg} (${s.eventCount})`.trim();
}

export default function SessionSelector({ sessions, selectedId, onSelect, loading }: Props) {
  const grouped = useMemo(() => {
    const groups = new Map<string, SessionSummary[]>();
    for (const s of sessions) {
      const key = s.gitBranch || "other";
      const list = groups.get(key) || [];
      list.push(s);
      groups.set(key, list);
    }
    return groups;
  }, [sessions]);

  if (loading) {
    return <div className="text-gray-400 text-sm px-3 py-2">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return <div className="text-gray-500 text-sm px-3 py-2">No sessions found</div>;
  }

  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => onSelect(e.target.value)}
      className="bg-gray-800 text-gray-200 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 min-w-[400px] max-w-[600px]"
    >
      <option value="" disabled>
        Select a session...
      </option>
      {[...grouped.entries()].map(([branch, items]) => (
        <optgroup key={branch} label={`branch: ${branch}`}>
          {items.map((s) => (
            <option key={s.id} value={s.id}>
              {sessionLabel(s)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
