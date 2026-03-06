import { useState, useMemo, useCallback } from "react";
import type { EventType, TimelineEvent } from "@/types";
import { useSessionList, useSessionData } from "@/hooks/useSession";
import SessionSelector from "@/components/SessionSelector";
import FilterBar from "@/components/FilterBar";
import Timeline from "@/components/Timeline";
import DetailPanel from "@/components/DetailPanel";
import TaskProgress from "@/components/TaskProgress";

export default function App() {
  const { sessions, loading: sessionsLoading } = useSessionList();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { data: session, loading: sessionLoading } = useSessionData(selectedSessionId);

  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<EventType>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const agents = useMemo(
    () => session?.agents.map((a) => a.name) ?? [],
    [session],
  );

  // Initialize filters when session loads
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  if (session && session.id !== lastSessionId) {
    setLastSessionId(session.id);
    setSelectedAgents(new Set(session.agents.map((a) => a.name)));
    const types = new Set(session.events.map((e) => e.type));
    setSelectedTypes(types);
    setSelectedEvent(null);
    setSearchText("");
  }

  const toggleAgent = useCallback((agent: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) next.delete(agent);
      else next.add(agent);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: EventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const filteredEvents = useMemo(() => {
    if (!session) return [];
    return session.events.filter((e) => {
      if (!selectedAgents.has(e.agentName)) return false;
      if (!selectedTypes.has(e.type)) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const matches =
          e.summary.toLowerCase().includes(q) ||
          e.detail.toLowerCase().includes(q) ||
          e.agentName.toLowerCase().includes(q) ||
          (e.toolName?.toLowerCase().includes(q) ?? false) ||
          (e.filePath?.toLowerCase().includes(q) ?? false);
        if (!matches) return false;
      }
      return true;
    });
  }, [session, selectedAgents, selectedTypes, searchText]);

  const filteredEdges = useMemo(() => {
    if (!session) return [];
    const eventIds = new Set(filteredEvents.map((e) => e.id));
    return session.edges.filter(
      (edge) => eventIds.has(edge.sourceEventId) && eventIds.has(edge.targetEventId),
    );
  }, [session, filteredEvents]);

  const filteredAgents = useMemo(
    () => agents.filter((a) => selectedAgents.has(a)),
    [agents, selectedAgents],
  );

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="text-sm font-bold text-gray-200 whitespace-nowrap">
          Agent Timeline
        </h1>
        <SessionSelector
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={setSelectedSessionId}
          loading={sessionsLoading}
        />
        {sessionLoading && (
          <span className="text-gray-400 text-sm">Loading...</span>
        )}
      </div>

      {session && (
        <FilterBar
          agents={agents}
          selectedAgents={selectedAgents}
          onToggleAgent={toggleAgent}
          selectedTypes={selectedTypes}
          onToggleType={toggleType}
          searchText={searchText}
          onSearchChange={setSearchText}
        />
      )}

      {/* main content */}
      <div className="flex-1 flex overflow-hidden">
        {session ? (
          <Timeline
            events={filteredEvents}
            edges={filteredEdges}
            agents={filteredAgents}
            onSelectEvent={setSelectedEvent}
            selectedEventId={selectedEvent?.id ?? null}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a session to view the timeline
          </div>
        )}

        <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      </div>

      {/* task progress */}
      {session && <TaskProgress tasks={session.tasks} />}
    </div>
  );
}
