"use client";

/**
 * Calendar Context - now backed by Legit versioned filesystem.
 *
 * This file re-exports from legit-calendar-context for backward compatibility.
 * The new LegitCalendarProvider provides the same interface as the old CalendarProvider,
 * but with additional Legit capabilities:
 * - Version history (see all changes)
 * - Rollback (undo any number of changes)
 * - Multi-agent support (concurrent editing via branches)
 *
 * For new code, consider importing directly from "@/legit-webmcp" to access
 * the additional Legit-specific features like history, rollback, and agentId.
 */

// Re-export everything from the Legit-backed implementation
export {
  LegitCalendarProvider as CalendarProvider,
  useLegitCalendar as useCalendar,
  useLegitCalendar,
  LegitCalendarProvider,
} from "@/legit-webmcp/legit-calendar-context";
