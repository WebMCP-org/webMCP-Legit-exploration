"use client";

import { useMemo } from "react";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import { useAgentPreview } from "@/calendar/contexts/agent-preview-context";
import type { IEvent } from "@/calendar/interfaces";

/**
 * Hook that combines main branch events with phantom events from agent preview.
 *
 * When preview mode is active:
 * - Removed events are marked with _phantom: "removed"
 * - Added events are included with _phantom: "added"
 * - Modified events show the new version with _phantom: "modified"
 *
 * When preview mode is inactive, returns regular events unchanged.
 *
 * @returns Combined events array with phantom status applied
 */
export function useCombinedEvents(): IEvent[] {
  const { events } = useCalendar();
  const { isPreviewMode, pendingChanges, previewAgentId } = useAgentPreview();

  return useMemo(() => {
    // If not in preview mode, return events as-is
    if (!isPreviewMode) {
      return events;
    }

    const { added, modified, removed } = pendingChanges;

    // Get IDs of events that have changes
    const removedIds = new Set(removed.map((e) => e.id));

    // Start with main events, marking removed ones
    const result: IEvent[] = events
      .map((event) => {
        // Check if this event is removed
        if (removedIds.has(event.id)) {
          return {
            ...event,
            _phantom: "removed" as const,
            _agentId: previewAgentId || undefined,
          };
        }

        // Check if this event is modified
        const modifiedEntry = modified.find((m) => m.before.id === event.id);
        if (modifiedEntry) {
          return {
            ...modifiedEntry.after,
            _phantom: "modified" as const,
            _agentId: previewAgentId || undefined,
          };
        }

        // Unchanged event
        return event;
      });

    // Add new events from agent branch
    const addedEvents: IEvent[] = added.map((event) => ({
      ...event,
      _phantom: "added" as const,
      _agentId: previewAgentId || undefined,
    }));

    return [...result, ...addedEvents];
  }, [events, isPreviewMode, pendingChanges, previewAgentId]);
}

/**
 * Hook to get summary of pending changes
 */
export function usePendingChangesSummary() {
  const { pendingChanges, isPreviewMode, previewAgentId } = useAgentPreview();

  return useMemo(() => {
    if (!isPreviewMode) {
      return null;
    }

    const { added, modified, removed } = pendingChanges;
    const totalChanges = added.length + modified.length + removed.length;

    return {
      agentId: previewAgentId,
      added: added.length,
      modified: modified.length,
      removed: removed.length,
      total: totalChanges,
      hasChanges: totalChanges > 0,
      summary: [
        added.length > 0 && `+${added.length} added`,
        modified.length > 0 && `~${modified.length} modified`,
        removed.length > 0 && `-${removed.length} removed`,
      ]
        .filter(Boolean)
        .join(", "),
    };
  }, [pendingChanges, isPreviewMode, previewAgentId]);
}
