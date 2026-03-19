import { useState } from "react";
import type { TimelineEvent } from "@/types";
import { getEventColor, getEventLabel } from "@/utils/colors";

interface Props {
  event: TimelineEvent;
}

/** Render a structured detail value (string, object, array, etc.) */
function DetailValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-yellow-400">{value ? "true" : "false"}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-blue-400">{value}</span>;
  }

  if (typeof value === "string") {
    // Long strings get a collapsible view
    if (value.length > 200) {
      return (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-purple-400 hover:text-purple-300 text-[10px] mb-1"
          >
            {expanded ? "▼" : "▶"} {value.length} chars
          </button>
          {expanded ? (
            <pre className="text-gray-300 text-xs bg-gray-950 rounded p-2 whitespace-pre-wrap break-words max-h-48 overflow-auto">
              {value}
            </pre>
          ) : (
            <span className="text-gray-300 text-xs">{value.slice(0, 80)}…</span>
          )}
        </div>
      );
    }
    return <span className="text-green-400 text-xs break-words">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-500">[]</span>;
    return (
      <div className="pl-2 border-l border-gray-700 space-y-1">
        {value.map((item, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="text-gray-600 text-[10px] mt-0.5 shrink-0">{i}</span>
            <DetailValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-gray-500">{"{}"}</span>;
    return (
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-purple-300 text-[11px] font-medium mb-0.5">{k}</div>
            <div className="pl-2">
              <DetailValue value={v} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-gray-300 text-xs">{String(value)}</span>;
}

/** Try to parse detail as JSON and render structured view, fallback to pre */
function StructuredDetail({ detail }: { detail: string }) {
  const [showRaw, setShowRaw] = useState(false);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(detail);
  } catch {
    // Not JSON, render as plain text
    return (
      <pre className="text-gray-300 text-xs bg-gray-900 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">
        {detail}
      </pre>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-[10px] text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-1.5 py-0.5"
        >
          {showRaw ? "Structured" : "Raw JSON"}
        </button>
      </div>
      {showRaw ? (
        <pre className="text-gray-300 text-xs bg-gray-900 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">
          {detail}
        </pre>
      ) : (
        <div className="bg-gray-900 rounded p-3 overflow-auto max-h-80">
          <DetailValue value={parsed} />
        </div>
      )}
    </div>
  );
}

export default function EventNode({ event }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: getEventColor(event.type) }}
        />
        <span className="text-xs uppercase tracking-wide text-gray-400">
          {getEventLabel(event.type)}
        </span>
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">Summary</div>
        <div className="text-gray-200 text-sm">{event.summary}</div>
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">Agent</div>
        <div className="text-gray-200 text-sm">{event.agentName}</div>
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">Time</div>
        <div className="text-gray-200 text-sm">
          {new Date(event.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {event.toolName && (
        <div>
          <div className="text-gray-400 text-xs mb-1">Tool</div>
          <div className="text-gray-200 text-sm font-mono">{event.toolName}</div>
        </div>
      )}

      {event.filePath && (
        <div>
          <div className="text-gray-400 text-xs mb-1">File</div>
          <div className="text-gray-200 text-sm font-mono break-all">{event.filePath}</div>
        </div>
      )}

      {event.taskId && (
        <div>
          <div className="text-gray-400 text-xs mb-1">Task ID</div>
          <div className="text-gray-200 text-sm">{event.taskId}</div>
        </div>
      )}

      {event.recipient && (
        <div>
          <div className="text-gray-400 text-xs mb-1">Recipient</div>
          <div className="text-gray-200 text-sm">{event.recipient}</div>
        </div>
      )}

      {event.detail && (
        <div>
          <div className="text-gray-400 text-xs mb-1">Detail</div>
          <StructuredDetail detail={event.detail} />
        </div>
      )}

      {event.rawContent && (
        <div>
          <div className="text-gray-400 text-xs mb-1">Raw Content</div>
          <pre className="text-gray-300 text-xs bg-gray-900 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">
            {event.rawContent}
          </pre>
        </div>
      )}
    </div>
  );
}
