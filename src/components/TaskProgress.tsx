import type { TaskInfo } from "@/types";

interface Props {
  tasks: TaskInfo[];
}

export default function TaskProgress({ tasks }: Props) {
  if (tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const total = tasks.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center gap-4 text-xs">
      <span className="text-gray-400">Tasks:</span>
      <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-gray-300">
        {completed}/{total} done
      </span>
      {inProgress > 0 && (
        <span className="text-yellow-400">{inProgress} in progress</span>
      )}
    </div>
  );
}
