import type { DisplayMode } from "@/types";

interface Props {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

export default function DisplayModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex rounded border border-gray-600 text-xs overflow-hidden">
      <button
        className={`px-2.5 py-1 transition-colors ${
          mode === "timeline"
            ? "bg-gray-600 text-white"
            : "bg-gray-800 text-gray-400 hover:text-gray-200"
        }`}
        onClick={() => onChange("timeline")}
        title="Timeline view"
      >
        Timeline
      </button>
      <button
        className={`px-2.5 py-1 transition-colors ${
          mode === "avatar"
            ? "bg-gray-600 text-white"
            : "bg-gray-800 text-gray-400 hover:text-gray-200"
        }`}
        onClick={() => onChange("avatar")}
        title="Avatar view"
      >
        Avatar
      </button>
    </div>
  );
}
