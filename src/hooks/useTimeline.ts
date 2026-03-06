import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as d3 from "d3";
import type { TimelineEvent } from "@/types";

interface Dimensions {
  width: number;
  height: number;
  margin: { top: number; left: number; right: number; bottom: number };
}

const LANE_HEIGHT = 60;

export function useTimeline(
  events: TimelineEvent[],
  agents: string[],
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 800,
    height: 400,
    margin: { top: 40, left: 140, right: 20, bottom: 30 },
  });

  const [transform, setTransform] = useState(() => d3.zoomIdentity as d3.ZoomTransform);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions((prev) => ({ ...prev, width, height }));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef]);

  const innerWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
  const innerHeight = Math.max(
    dimensions.height - dimensions.margin.top - dimensions.margin.bottom,
    agents.length * LANE_HEIGHT,
  );

  const timeExtent = useMemo(() => {
    if (events.length === 0) return [new Date(), new Date()] as [Date, Date];
    const times = events.map((e) => new Date(e.timestamp).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const pad = Math.max((max - min) * 0.05, 1000);
    return [new Date(min - pad), new Date(max + pad)] as [Date, Date];
  }, [events]);

  const xScale = useMemo(
    () => d3.scaleTime().domain(timeExtent).range([0, innerWidth]),
    [timeExtent, innerWidth],
  );

  const yScale = useMemo(
    () =>
      d3
        .scaleBand<string>()
        .domain(agents)
        .range([0, innerHeight])
        .padding(0.2),
    [agents, innerHeight],
  );

  const zoomedXScale = useMemo(() => transform.rescaleX(xScale), [transform, xScale]);

  const setupZoom = useCallback(
    (svgEl: SVGSVGElement | null) => {
      if (!svgEl) return;
      const svg = d3.select(svgEl);
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 20])
        .translateExtent([
          [-100, 0],
          [dimensions.width + 100, dimensions.height],
        ])
        .on("zoom", (event) => {
          setTransform(event.transform);
        });
      zoomRef.current = zoom;
      svg.call(zoom);
    },
    [dimensions.width, dimensions.height],
  );

  return {
    dimensions,
    innerWidth,
    innerHeight,
    xScale: zoomedXScale,
    yScale,
    setupZoom,
    transform,
    LANE_HEIGHT,
  };
}
