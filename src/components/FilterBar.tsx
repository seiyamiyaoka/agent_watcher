import type { EventType } from "@/types";
import { getEventColor, getEventLabel } from "@/utils/colors";

const ALL_EVENT_TYPES: EventType[] = [
  "team_create", "agent_spawn", "message_send",
  "task_create", "task_complete", "task_update",
  "file_read", "file_write", "bash",
  "decision", "error",
];

interface Props {
  agents: string[];
  selectedAgents: Set<string>;
  onToggleAgent: (agent: string) => void;
  selectedTypes: Set<EventType>;
  onToggleType: (type: EventType) => void;
  searchText: string;
  onSearchChange: (text: string) => void;
}

export default function FilterBar({
  agents,
  selectedAgents,
  onToggleAgent,
  selectedTypes,
  onToggleType,
  searchText,
  onSearchChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 font-medium">Agents:</span>
        {agents.map((a) => (
          <label key={a} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.has(a)}
              onChange={() => onToggleAgent(a)}
              className="accent-purple-500"
            />
            <span className="text-gray-300">{a}</span>
          </label>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-600" />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-400 font-medium">Types:</span>
        {ALL_EVENT_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTypes.has(t)}
              onChange={() => onToggleType(t)}
              className="accent-purple-500"
            />
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: getEventColor(t) + "30", color: getEventColor(t) }}
            >
              {getEventLabel(t)}
            </span>
          </label>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-600" />

      <input
        type="text"
        placeholder="Search events..."
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-purple-500 w-48"
      />
    </div>
  );
}
