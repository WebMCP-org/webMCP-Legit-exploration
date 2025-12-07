"use client";

import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  parseISO,
  areIntervalsOverlapping,
  differenceInMinutes,
} from "date-fns";

/**
 * Tools specific to the day view - scoped to only appear on day-view page
 */
export function useDayViewTools() {
  const { events, selectedDate, setSelectedDate } = useCalendar();

  // Tool: Get detailed hourly breakdown of the day
  useWebMCP({
    name: "dayview_hourly_breakdown",
    description:
      "Get a detailed hour-by-hour breakdown of events for the currently viewed day. Only available in day view.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async () => {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      // Get events for this day
      const dayEvents = events.filter((e) => {
        const eventStart = parseISO(e.startDate);
        const eventEnd = parseISO(e.endDate);
        return areIntervalsOverlapping(
          { start: eventStart, end: eventEnd },
          { start: dayStart, end: dayEnd }
        );
      });

      // Create hourly breakdown
      const hourlyBreakdown: {
        hour: string;
        events: { title: string; status: string }[];
      }[] = [];

      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(dayStart);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(dayStart);
        hourEnd.setHours(hour, 59, 59, 999);

        const hourEvents = dayEvents
          .filter((e) => {
            const eventStart = parseISO(e.startDate);
            const eventEnd = parseISO(e.endDate);
            return areIntervalsOverlapping(
              { start: eventStart, end: eventEnd },
              { start: hourStart, end: hourEnd }
            );
          })
          .map((e) => {
            const eventStart = parseISO(e.startDate);
            const eventEnd = parseISO(e.endDate);

            let status = "ongoing";
            if (eventStart >= hourStart && eventStart <= hourEnd) {
              status = "starts";
            } else if (eventEnd >= hourStart && eventEnd <= hourEnd) {
              status = "ends";
            }

            return { title: e.title, status };
          });

        if (hourEvents.length > 0) {
          hourlyBreakdown.push({
            hour: format(hourStart, "h:mm a"),
            events: hourEvents,
          });
        }
      }

      // Calculate busy time
      const totalBusyMinutes = dayEvents.reduce((sum, e) => {
        const eventStart = parseISO(e.startDate);
        const eventEnd = parseISO(e.endDate);
        const effectiveStart = eventStart < dayStart ? dayStart : eventStart;
        const effectiveEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
        return sum + differenceInMinutes(effectiveEnd, effectiveStart);
      }, 0);

      return {
        date: format(selectedDate, "EEEE, MMMM d, yyyy"),
        totalEvents: dayEvents.length,
        busyTime: {
          hours: Math.floor(totalBusyMinutes / 60),
          minutes: totalBusyMinutes % 60,
        },
        hourlyBreakdown,
        message: `${format(selectedDate, "MMM d")} has ${dayEvents.length} events totaling ${Math.floor(totalBusyMinutes / 60)}h ${totalBusyMinutes % 60}m of scheduled time.`,
      };
    },
  });

  // Tool: Navigate to next/previous day
  useWebMCP({
    name: "dayview_navigate",
    description:
      "Navigate to the next or previous day from the current day view. Only available in day view.",
    inputSchema: {
      direction: z
        .enum(["next", "previous"])
        .describe("Direction to navigate"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ direction }) => {
      const offset = direction === "next" ? 1 : -1;
      const newDate = addDays(selectedDate, offset);

      setSelectedDate(newDate);

      // Get events for the new day
      const dayStart = startOfDay(newDate);
      const dayEnd = endOfDay(newDate);
      const dayEvents = events.filter((e) => {
        const eventStart = parseISO(e.startDate);
        const eventEnd = parseISO(e.endDate);
        return areIntervalsOverlapping(
          { start: eventStart, end: eventEnd },
          { start: dayStart, end: dayEnd }
        );
      });

      return {
        success: true,
        date: format(newDate, "EEEE, MMMM d, yyyy"),
        eventCount: dayEvents.length,
        message: `Navigated to ${format(newDate, "EEEE, MMM d")} with ${dayEvents.length} event(s).`,
      };
    },
  });

  // Tool: Get day summary with user breakdown
  useWebMCP({
    name: "dayview_summary",
    description:
      "Get a summary of the currently viewed day including events grouped by user. Only available in day view.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async () => {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      const dayEvents = events
        .filter((e) => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          return areIntervalsOverlapping(
            { start: eventStart, end: eventEnd },
            { start: dayStart, end: dayEnd }
          );
        })
        .sort(
          (a, b) =>
            parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
        );

      // Group by user
      const byUser: Record<string, { title: string; time: string }[]> = {};
      dayEvents.forEach((e) => {
        const userName = e.user.name;
        if (!byUser[userName]) {
          byUser[userName] = [];
        }
        byUser[userName].push({
          title: e.title,
          time: `${format(parseISO(e.startDate), "h:mm a")} - ${format(parseISO(e.endDate), "h:mm a")}`,
        });
      });

      // Find first and last events
      const firstEvent = dayEvents[0];
      const lastEvent = dayEvents[dayEvents.length - 1];

      return {
        date: format(selectedDate, "EEEE, MMMM d, yyyy"),
        totalEvents: dayEvents.length,
        timeRange:
          dayEvents.length > 0
            ? {
                firstEvent: format(parseISO(firstEvent.startDate), "h:mm a"),
                lastEvent: format(parseISO(lastEvent.endDate), "h:mm a"),
              }
            : null,
        eventsByUser: Object.entries(byUser).map(([user, events]) => ({
          user,
          eventCount: events.length,
          events,
        })),
        message:
          dayEvents.length > 0
            ? `${format(selectedDate, "MMM d")} has ${dayEvents.length} events from ${format(parseISO(firstEvent.startDate), "h:mm a")} to ${format(parseISO(lastEvent.endDate), "h:mm a")}.`
            : `${format(selectedDate, "MMM d")} has no scheduled events.`,
      };
    },
  });

  // Tool: Find conflicts/overlapping events
  useWebMCP({
    name: "dayview_find_conflicts",
    description:
      "Find any overlapping or conflicting events on the currently viewed day. Only available in day view.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async () => {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      const dayEvents = events
        .filter((e) => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          return areIntervalsOverlapping(
            { start: eventStart, end: eventEnd },
            { start: dayStart, end: dayEnd }
          );
        })
        .sort(
          (a, b) =>
            parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
        );

      // Find conflicts
      const conflicts: {
        event1: { id: number; title: string; time: string };
        event2: { id: number; title: string; time: string };
        overlapMinutes: number;
      }[] = [];

      for (let i = 0; i < dayEvents.length; i++) {
        for (let j = i + 1; j < dayEvents.length; j++) {
          const e1 = dayEvents[i];
          const e2 = dayEvents[j];

          const e1Start = parseISO(e1.startDate);
          const e1End = parseISO(e1.endDate);
          const e2Start = parseISO(e2.startDate);
          const e2End = parseISO(e2.endDate);

          if (
            areIntervalsOverlapping(
              { start: e1Start, end: e1End },
              { start: e2Start, end: e2End }
            )
          ) {
            // Calculate overlap
            const overlapStart = e1Start > e2Start ? e1Start : e2Start;
            const overlapEnd = e1End < e2End ? e1End : e2End;
            const overlapMinutes = differenceInMinutes(overlapEnd, overlapStart);

            conflicts.push({
              event1: {
                id: e1.id,
                title: e1.title,
                time: `${format(e1Start, "h:mm a")} - ${format(e1End, "h:mm a")}`,
              },
              event2: {
                id: e2.id,
                title: e2.title,
                time: `${format(e2Start, "h:mm a")} - ${format(e2End, "h:mm a")}`,
              },
              overlapMinutes,
            });
          }
        }
      }

      return {
        date: format(selectedDate, "EEEE, MMMM d, yyyy"),
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length,
        conflicts,
        message:
          conflicts.length > 0
            ? `Found ${conflicts.length} scheduling conflict(s) on ${format(selectedDate, "MMM d")}.`
            : `No scheduling conflicts on ${format(selectedDate, "MMM d")}.`,
      };
    },
  });
}
