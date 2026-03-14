import { useState, useMemo, useCallback } from "react";
import type { EventType, TimelineEvent, ViewMode, DisplayMode } from "@/types";
import { useSessionList, useSessionData } from "@/hooks/useSession";
import { usePeers, useTeamSessions } from "@/hooks/usePeers";
import SessionSelector from "@/components/SessionSelector";
import FilterBar from "@/components/FilterBar";
import Timeline from "@/components/Timeline";
import AvatarView from "@/components/AvatarView";
import DetailPanel from "@/components/DetailPanel";
import TaskProgress from "@/components/TaskProgress";
import PeerStatusBar from "@/components/PeerStatusBar";
import ViewModeToggle from "@/components/ViewModeToggle";
import DisplayModeToggle from "@/components/DisplayModeToggle";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("local");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("timeline");
  const { sessions: localSessions, loading: localLoading } = useSessionList();
  const { sessions: teamSessions, loading: teamLoading } = useTeamSessions();
  const { peers } = usePeers();

  const sessions = viewMode === "team" ? teamSessions : localSessions;
  const sessionsLoading = viewMode === "team" ? teamLoading : localLoading;

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const { data: session, loading: sessionLoading } = useSessionData(
    selectedSessionId,
    viewMode === "team" ? selectedPeerId : null,
  );

  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<EventType>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const agents = useMemo(
    () => session?.agents.map((a) => a.name) ?? [],
    [session],
  );

  // Initialize filters when session loads
  const [lastSessionKey, setLastSessionKey] = useState<string | null>(null);
  const sessionKey = session ? `${selectedPeerId ?? "local"}:${session.id}` : null;
  if (session && sessionKey !== lastSessionKey) {
    setLastSessionKey(sessionKey);
    setSelectedAgents(new Set(session.agents.map((a) => a.name)));
    const types = new Set(session.events.map((e) => e.type));
    setSelectedTypes(types);
    setSelectedEvent(null);
    setSearchText("");
  }

  const handleSelectSession = useCallback((id: string, peerId?: string) => {
    setSelectedSessionId(id);
    setSelectedPeerId(peerId ?? null);
  }, []);

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

  // Determine peer name for remote sessions
  const activePeerName = useMemo(() => {
    if (viewMode !== "team" || !selectedPeerId || selectedPeerId === "local") return null;
    const selected = sessions.find(
      (s) => s.id === selectedSessionId && s.peerId === selectedPeerId,
    );
    return selected?.peerName ?? selectedPeerId;
  }, [viewMode, selectedPeerId, selectedSessionId, sessions]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="text-sm font-bold text-gray-200 whitespace-nowrap">
          Agent Timeline
        </h1>
        <DisplayModeToggle mode={displayMode} onChange={setDisplayMode} />
        <div className="w-px h-5 bg-gray-600" />
        <ViewModeToggle
          mode={viewMode}
          onChange={setViewMode}
          peerCount={peers.length}
        />
        <SessionSelector
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={handleSelectSession}
          loading={sessionsLoading}
          viewMode={viewMode}
        />
        {sessionLoading && (
          <span className="text-gray-400 text-sm">Loading...</span>
        )}
      </div>

      {/* peer status bar */}
      {viewMode === "team" && <PeerStatusBar peers={peers} />}

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
          displayMode === "avatar" ? (
            <AvatarView
              events={filteredEvents}
              agents={filteredAgents}
              onSelectEvent={setSelectedEvent}
              selectedEventId={selectedEvent?.id ?? null}
              peerName={activePeerName}
            />
          ) : (
            <Timeline
              events={filteredEvents}
              edges={filteredEdges}
              agents={filteredAgents}
              onSelectEvent={setSelectedEvent}
              selectedEventId={selectedEvent?.id ?? null}
              peerName={activePeerName}
            />
          )
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
