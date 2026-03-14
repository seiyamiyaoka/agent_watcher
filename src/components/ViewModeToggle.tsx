import type { ViewMode } from "@/types";

interface Props {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  peerCount: number;
}

export default function ViewModeToggle({ mode, onChange, peerCount }: Props) {
  return (
    <div className="flex rounded border border-gray-600 text-xs overflow-hidden">
      <button
        className={`px-3 py-1 transition-colors ${
          mode === "local"
            ? "bg-purple-600 text-white"
            : "bg-gray-800 text-gray-400 hover:text-gray-200"
        }`}
        onClick={() => onChange("local")}
      >
        My Sessions
      </button>
      <button
        className={`px-3 py-1 transition-colors ${
          mode === "team"
            ? "bg-purple-600 text-white"
            : "bg-gray-800 text-gray-400 hover:text-gray-200"
        }`}
        onClick={() => onChange("team")}
      >
        Team{peerCount > 1 ? ` (${peerCount})` : ""}
      </button>
    </div>
  );
}
