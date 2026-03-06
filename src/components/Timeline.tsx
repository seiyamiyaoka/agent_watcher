import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import * as d3 from "d3";
import type { TimelineEvent, Edge } from "@/types";
import { getEventColor } from "@/utils/colors";
import { useTimeline } from "@/hooks/useTimeline";

interface Props {
  events: TimelineEvent[];
  edges: Edge[];
  agents: string[];
  onSelectEvent: (event: TimelineEvent) => void;
  selectedEventId: string | null;
}

export default function Timeline({
  events,
  edges,
  agents,
  onSelectEvent,
  selectedEventId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const { dimensions, innerWidth, innerHeight, xScale, yScale, setupZoom, LANE_HEIGHT } =
    useTimeline(events, agents, containerRef);

  const { margin } = dimensions;

  const svgRefCallback = useCallback(
    (node: SVGSVGElement | null) => {
      svgRef.current = node;
      setupZoom(node);
    },
    [setupZoom],
  );

  const eventMap = useMemo(() => {
    const map = new Map<string, TimelineEvent>();
    events.forEach((e) => map.set(e.id, e));
    return map;
  }, [events]);

  const edgePaths = useMemo(() => {
    return edges
      .map((edge) => {
        const source = eventMap.get(edge.sourceEventId);
        const target = eventMap.get(edge.targetEventId);
        if (!source || !target) return null;

        const sx = xScale(new Date(source.timestamp));
        const sy = (yScale(source.agentName) ?? 0) + (yScale.bandwidth?.() ?? LANE_HEIGHT) / 2;
        const tx = xScale(new Date(target.timestamp));
        const ty = (yScale(target.agentName) ?? 0) + (yScale.bandwidth?.() ?? LANE_HEIGHT) / 2;

        const midX = (sx + tx) / 2;
        const d = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;

        const edgeColor =
          edge.type === "message"
            ? "#8B5CF6"
            : edge.type === "task"
              ? "#EAB308"
              : edge.type === "spawn"
                ? "#8B5CF6"
                : "#3B82F6";

        return { ...edge, d, color: edgeColor };
      })
      .filter(Boolean);
  }, [edges, eventMap, xScale, yScale, LANE_HEIGHT]);

  const xAxis = useMemo(() => {
    return d3.axisBottom(xScale).ticks(8).tickFormat((d) => d3.timeFormat("%H:%M:%S")(d as Date));
  }, [xScale]);

  const axisRef = useCallback(
    (g: SVGGElement | null) => {
      if (g) d3.select(g).call(xAxis).selectAll("text").attr("fill", "#9CA3AF").attr("font-size", "10px");
      if (g) d3.select(g).selectAll("line,path").attr("stroke", "#4B5563");
    },
    [xAxis],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelectEvent(null as unknown as TimelineEvent);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectEvent]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative">
      <svg
        ref={svgRefCallback}
        width={dimensions.width}
        height={dimensions.height}
        className="select-none"
      >
        <defs>
          <clipPath id="timeline-clip">
            <rect x={0} y={0} width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* agent lane backgrounds */}
          {agents.map((agent, i) => (
            <g key={agent}>
              <rect
                x={0}
                y={yScale(agent) ?? 0}
                width={innerWidth}
                height={yScale.bandwidth?.() ?? LANE_HEIGHT}
                fill={i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"}
              />
              <text
                x={-8}
                y={(yScale(agent) ?? 0) + (yScale.bandwidth?.() ?? LANE_HEIGHT) / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#9CA3AF"
                fontSize={12}
              >
                {agent}
              </text>
            </g>
          ))}

          {/* clipped content area */}
          <g clipPath="url(#timeline-clip)">
            {/* edges */}
            {edgePaths.map(
              (ep) =>
                ep && (
                  <path
                    key={ep.id}
                    d={ep.d}
                    fill="none"
                    stroke={ep.color}
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                    strokeDasharray={ep.type === "spawn" ? "4 2" : undefined}
                  />
                ),
            )}

            {/* event nodes */}
            {events.map((event) => {
              const cx = xScale(new Date(event.timestamp));
              const cy =
                (yScale(event.agentName) ?? 0) +
                (yScale.bandwidth?.() ?? LANE_HEIGHT) / 2;
              const isSelected = event.id === selectedEventId;
              const r = isSelected ? 7 : 5;

              return (
                <circle
                  key={event.id}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={getEventColor(event.type)}
                  stroke={isSelected ? "#fff" : "transparent"}
                  strokeWidth={isSelected ? 2 : 0}
                  className="cursor-pointer transition-all duration-100"
                  onClick={() => onSelectEvent(event)}
                  onMouseEnter={(e) => {
                    const svgRect = svgRef.current?.getBoundingClientRect();
                    if (svgRect) {
                      setTooltip({
                        x: e.clientX - svgRect.left,
                        y: e.clientY - svgRect.top - 10,
                        text: event.summary,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </g>

          {/* x axis */}
          <g ref={axisRef} transform={`translate(0, ${innerHeight})`} />
        </g>
      </svg>

      {/* tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 max-w-xs z-50"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
