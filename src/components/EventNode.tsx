import type { TimelineEvent } from "@/types";
import { getEventColor, getEventLabel } from "@/utils/colors";

interface Props {
  event: TimelineEvent;
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
          <pre className="text-gray-300 text-xs bg-gray-900 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">
            {event.detail}
          </pre>
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
