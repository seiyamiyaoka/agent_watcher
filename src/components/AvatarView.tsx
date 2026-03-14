import { useRef, useEffect, useMemo, useState } from "react";
import type { TimelineEvent } from "@/types";
import { getAgentEmoji, getEventEmoji } from "@/utils/avatars";
import { getEventColor } from "@/utils/colors";

interface Props {
  events: TimelineEvent[];
  agents: string[];
  onSelectEvent: (event: TimelineEvent) => void;
  selectedEventId: string | null;
  peerName?: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function truncatePath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 3) return path;
  return ".../" + parts.slice(-2).join("/");
}

export default function AvatarView({
  events,
  agents,
  onSelectEvent,
  selectedEventId,
  peerName,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevEventCountRef = useRef(0);

  // Assign column index to each agent
  const agentColumns = useMemo(() => {
    const map = new Map<string, number>();
    agents.forEach((a, i) => map.set(a, i));
    return map;
  }, [agents]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current && events.length > prevEventCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevEventCountRef.current = events.length;
  }, [events.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Agent header row */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700">
        {peerName && (
          <div className="px-4 py-1 text-xs text-purple-300 border-b border-gray-700">
            {peerName}
          </div>
        )}
        <div className="flex">
          {/* Time column */}
          <div className="w-16 flex-shrink-0" />
          {/* Agent columns */}
          {agents.map((agent) => (
            <div
              key={agent}
              className="flex-1 min-w-[140px] flex flex-col items-center py-2 gap-1"
            >
              <span className="text-2xl">{getAgentEmoji(agent)}</span>
              <span className="text-xs text-gray-400 truncate max-w-[120px]">
                {agent}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable event area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className="relative min-h-full">
          {events.map((event) => {
            const colIndex = agentColumns.get(event.agentName) ?? 0;
            const isSelected = event.id === selectedEventId;
            const eventEmoji = getEventEmoji(event.type);
            const borderColor = getEventColor(event.type);

            return (
              <div key={event.id} className="flex items-start group">
                {/* Time column */}
                <div className="w-16 flex-shrink-0 text-[10px] text-gray-500 pt-3 text-right pr-2 tabular-nums">
                  {formatTime(event.timestamp)}
                </div>

                {/* Agent columns - place bubble in the right column */}
                {agents.map((agent, i) => (
                  <div
                    key={agent}
                    className="flex-1 min-w-[140px] flex flex-col items-center relative"
                  >
                    {/* Vertical guide line */}
                    <div className="absolute top-0 bottom-0 w-px bg-gray-800 left-1/2" />

                    {i === colIndex && (
                      <div
                        className={`relative z-10 mx-2 my-1 cursor-pointer transition-all duration-150 ${
                          isSelected ? "scale-105" : "hover:scale-[1.02]"
                        }`}
                        onClick={() => onSelectEvent(event)}
                      >
                        {/* Speech bubble */}
                        <div
                          className={`rounded-xl px-3 py-2 text-sm max-w-[280px] shadow-md ${
                            isSelected
                              ? "bg-gray-700 ring-2"
                              : "bg-gray-800 hover:bg-gray-750"
                          }`}
                          style={{
                            borderLeft: `3px solid ${borderColor}`,
                            ...(isSelected ? { ringColor: borderColor } : {}),
                          }}
                        >
                          {/* Event type indicator */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs">{eventEmoji}</span>
                            <span
                              className="text-[10px] font-medium uppercase tracking-wide"
                              style={{ color: borderColor }}
                            >
                              {event.type.replace(/_/g, " ")}
                            </span>
                          </div>

                          {/* Summary */}
                          <p className="text-gray-200 text-xs leading-relaxed break-words">
                            {event.summary}
                          </p>

                          {/* File path */}
                          {event.filePath && (
                            <p className="text-[10px] text-gray-500 mt-1 font-mono truncate">
                              {truncatePath(event.filePath)}
                            </p>
                          )}
                        </div>

                        {/* Bubble tail - small triangle pointing up to avatar column */}
                        <div
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                          style={{
                            backgroundColor: isSelected ? "#374151" : "#1f2937",
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Bottom padding for scroll */}
          <div className="h-8" />
        </div>
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          className="absolute bottom-16 right-8 bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg transition-colors"
          onClick={() => {
            setAutoScroll(true);
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            });
          }}
        >
          Latest
        </button>
      )}
    </div>
  );
}
