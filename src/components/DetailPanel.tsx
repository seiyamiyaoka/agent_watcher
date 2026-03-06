import type { TimelineEvent } from "@/types";
import EventNode from "./EventNode";

interface Props {
  event: TimelineEvent | null;
  onClose: () => void;
}

export default function DetailPanel({ event, onClose }: Props) {
  if (!event) return null;

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 h-full overflow-y-auto flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200">Event Detail</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-lg leading-none"
        >
          x
        </button>
      </div>
      <div className="p-4 flex-1">
        <EventNode event={event} />
      </div>
    </div>
  );
}
