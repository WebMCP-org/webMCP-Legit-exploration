"use client";

import { useRouter, usePathname } from "next/navigation";
import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import type { IEvent } from "@/calendar/interfaces";
import type { TEventColor, TCalendarView } from "@/calendar/types";
import {
  format,
  startOfDay,
  endOfDay,
  addHours,
  areIntervalsOverlapping,
  parseISO,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";

const VIEW_ROUTES: Record<TCalendarView, string> = {
  day: "/day-view",
  week: "/week-view",
  month: "/month-view",
  year: "/year-view",
  agenda: "/agenda-view",
};

/**
 * Smart/high-level tools that perform multi-step actions
 * and navigate to show results to the user
 */
export function useSmartTools() {
  const router = useRouter();
  const pathname = usePathname();
  const { events, setLocalEvents, users, selectedDate, setSelectedDate } =
    useCalendar();

  // Tool: Schedule a meeting - THE primary way to create events
  useWebMCP({
    name: "calendar_schedule_meeting",
    description: `Create a new calendar event and navigate to show it. This is the PRIMARY way to create events.

The view automatically navigates to show the created event so the user can see it.

Example: Schedule a 1-hour meeting tomorrow at 2pm:
{ "title": "Team Sync", "date": "2025-12-08", "startTime": "14:00" }`,
    inputSchema: {
      title: z.string().min(1).describe("Meeting title"),
      description: z
        .string()
        .optional()
        .default("")
        .describe("Meeting description (optional)"),
      date: z.string().describe("Date of the meeting (YYYY-MM-DD format, e.g., '2025-12-08')"),
      startTime: z
        .string()
        .describe("Start time in 24h format (HH:MM, e.g., '14:00' for 2pm)"),
      durationMinutes: z.coerce
        .number()
        .default(60)
        .describe("Duration in minutes (default: 60)"),
      color: z
        .enum(["blue", "green", "red", "yellow", "purple", "orange", "gray"])
        .default("blue")
        .describe("Event color (default: blue)"),
      userId: z
        .string()
        .optional()
        .describe("User ID to assign (uses first user if not specified). Get IDs from calendar_get_state."),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
    handler: async ({
      title,
      description,
      date,
      startTime,
      durationMinutes,
      color,
      userId,
    }) => {
      // Find user
      const user = userId
        ? users.find((u) => u.id === userId)
        : users[0];
      if (!user) {
        throw new Error(
          `User not found. Use calendar_get_state to see available users.`
        );
      }

      // Parse date and time
      const startDate = new Date(`${date}T${startTime}:00`);
      if (isNaN(startDate.getTime())) {
        throw new Error(`Invalid date/time: "${date}T${startTime}". Use YYYY-MM-DD and HH:MM format.`);
      }
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      const newEvent: IEvent = {
        id: Date.now(),
        title,
        description: description || "",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        color: color as TEventColor,
        user,
      };

      setLocalEvents((prev) => [...prev, newEvent]);

      // Navigate to the date and appropriate view
      setSelectedDate(startDate);

      // Determine best view based on duration
      const bestView = durationMinutes <= 240 ? "day" : "week";
      router.push(VIEW_ROUTES[bestView]);

      return {
        success: true,
        message: `Created "${title}" on ${format(startDate, "EEEE, MMMM d, yyyy")} at ${format(startDate, "h:mm a")} for ${durationMinutes} minutes. Navigated to ${bestView} view.`,
        event: {
          id: newEvent.id,
          title: newEvent.title,
          startDate: newEvent.startDate,
          endDate: newEvent.endDate,
          color: newEvent.color,
          user: newEvent.user.name,
        },
        navigatedTo: bestView,
      };
    },
  });

  // Tool: Find free time slots
  useWebMCP({
    name: "calendar_find_free_time",
    description:
      "Find available time slots on a given day. Useful before scheduling meetings. Navigates to day view to show the day.",
    inputSchema: {
      date: z.string().describe("Date to check (YYYY-MM-DD format, e.g., '2025-12-08')"),
      durationMinutes: z.coerce
        .number()
        .default(60)
        .describe("Minimum duration needed in minutes (default: 60)"),
      workingHoursOnly: z.coerce
        .boolean()
        .default(true)
        .describe("Only show slots during working hours 9-17 (default: true)"),
      userId: z
        .string()
        .optional()
        .describe("Filter by specific user's availability"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ date, durationMinutes, workingHoursOnly, userId }) => {
      const dayStart = startOfDay(parseISO(date));
      const dayEnd = endOfDay(parseISO(date));

      // Get events for this day
      let dayEvents = events.filter((e) => {
        const eventStart = parseISO(e.startDate);
        const eventEnd = parseISO(e.endDate);
        return areIntervalsOverlapping(
          { start: eventStart, end: eventEnd },
          { start: dayStart, end: dayEnd }
        );
      });

      // Filter by user if specified
      if (userId) {
        dayEvents = dayEvents.filter((e) => e.user.id === userId);
      }

      // Define time range to check
      const startHour = workingHoursOnly ? 9 : 0;
      const endHour = workingHoursOnly ? 17 : 24;

      const freeSlots: { start: string; end: string; durationMinutes: number }[] = [];

      // Check each hour slot
      for (let hour = startHour; hour < endHour; hour++) {
        const slotStart = addHours(dayStart, hour);
        const slotEnd = addHours(slotStart, 1);

        // Check if this slot conflicts with any event
        const hasConflict = dayEvents.some((e) => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          return areIntervalsOverlapping(
            { start: slotStart, end: slotEnd },
            { start: eventStart, end: eventEnd }
          );
        });

        if (!hasConflict) {
          // Try to extend the slot
          let extendedEnd = slotEnd;
          for (let nextHour = hour + 1; nextHour < endHour; nextHour++) {
            const nextSlotStart = addHours(dayStart, nextHour);
            const nextSlotEnd = addHours(nextSlotStart, 1);

            const nextHasConflict = dayEvents.some((e) => {
              const eventStart = parseISO(e.startDate);
              const eventEnd = parseISO(e.endDate);
              return areIntervalsOverlapping(
                { start: nextSlotStart, end: nextSlotEnd },
                { start: eventStart, end: eventEnd }
              );
            });

            if (nextHasConflict) break;
            extendedEnd = nextSlotEnd;
            hour = nextHour; // Skip checked hours
          }

          const slotDuration = (extendedEnd.getTime() - slotStart.getTime()) / 60000;

          if (slotDuration >= durationMinutes) {
            freeSlots.push({
              start: format(slotStart, "HH:mm"),
              end: format(extendedEnd, "HH:mm"),
              durationMinutes: slotDuration,
            });
          }
        }
      }

      // Navigate to day view to show the day
      setSelectedDate(dayStart);
      router.push(VIEW_ROUTES.day);

      return {
        date: format(dayStart, "EEEE, MMMM d, yyyy"),
        freeSlots,
        totalFreeMinutes: freeSlots.reduce((sum, s) => sum + s.durationMinutes, 0),
        existingEventsCount: dayEvents.length,
        message:
          freeSlots.length > 0
            ? `Found ${freeSlots.length} free slot(s) on ${format(dayStart, "MMM d")}. Navigated to day view.`
            : `No free slots of ${durationMinutes}+ minutes available.`,
        navigatedTo: "day",
      };
    },
  });

  // Tool: Show day summary with navigation
  useWebMCP({
    name: "calendar_show_day",
    description:
      "Navigate to a specific day and show a summary of events. Use this when the user asks 'what's on my calendar for [date]'.",
    inputSchema: {
      date: z
        .string()
        .optional()
        .describe("Date to show (YYYY-MM-DD). Defaults to today."),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ date }) => {
      const targetDate = date ? parseISO(date) : new Date();
      const dayStart = startOfDay(targetDate);
      const dayEnd = endOfDay(targetDate);

      // Get events for this day
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

      // Navigate to day view
      setSelectedDate(targetDate);
      router.push(VIEW_ROUTES.day);

      return {
        date: format(targetDate, "EEEE, MMMM d, yyyy"),
        eventCount: dayEvents.length,
        events: dayEvents.map((e) => ({
          id: e.id,
          title: e.title,
          time: `${format(parseISO(e.startDate), "h:mm a")} - ${format(parseISO(e.endDate), "h:mm a")}`,
          user: e.user.name,
          color: e.color,
        })),
        message: dayEvents.length > 0
          ? `${format(targetDate, "EEEE, MMMM d")} has ${dayEvents.length} event(s).`
          : `${format(targetDate, "EEEE, MMMM d")} is clear - no events scheduled.`,
        navigatedTo: "day",
      };
    },
  });

  // Tool: Show week overview with navigation
  useWebMCP({
    name: "calendar_show_week",
    description:
      "Navigate to a week view and show an overview of all events that week. Use this for weekly planning.",
    inputSchema: {
      date: z
        .string()
        .optional()
        .describe("Any date within the week to show (YYYY-MM-DD). Defaults to current week."),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ date }) => {
      const targetDate = date ? parseISO(date) : new Date();
      const weekStart = startOfWeek(targetDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(targetDate, { weekStartsOn: 0 });

      // Get events for this week
      const weekEvents = events
        .filter((e) => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          return areIntervalsOverlapping(
            { start: eventStart, end: eventEnd },
            { start: weekStart, end: weekEnd }
          );
        })
        .sort(
          (a, b) =>
            parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
        );

      // Group by day
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const eventsByDay = days.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayEvents = weekEvents.filter((e) => {
          const eventStart = parseISO(e.startDate);
          return eventStart >= dayStart && eventStart <= dayEnd;
        });
        return {
          day: format(day, "EEE, MMM d"),
          count: dayEvents.length,
          events: dayEvents.map((e) => e.title).slice(0, 3),
        };
      });

      // Navigate to week view
      setSelectedDate(targetDate);
      router.push(VIEW_ROUTES.week);

      return {
        weekRange: `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`,
        totalEvents: weekEvents.length,
        byDay: eventsByDay,
        message: `Week of ${format(weekStart, "MMM d")} has ${weekEvents.length} event(s).`,
        navigatedTo: "week",
      };
    },
  });

  // Tool: Quick reschedule - move an event to a new time
  useWebMCP({
    name: "calendar_reschedule_event",
    description:
      "Move an existing event to a new date/time and navigate to show the change. Keeps the original duration by default.",
    inputSchema: {
      eventId: z.coerce.number().describe("ID of the event to reschedule (get from calendar_list_events)"),
      newDate: z.string().describe("New date (YYYY-MM-DD format, e.g., '2025-12-10')"),
      newStartTime: z
        .string()
        .describe("New start time in 24h format (HH:MM, e.g., '14:00')"),
      keepDuration: z.coerce
        .boolean()
        .default(true)
        .describe("Keep the original duration (default: true)"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ eventId, newDate, newStartTime, keepDuration }) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        throw new Error(`Event with ID ${eventId} not found. Use calendar_list_events to see available events.`);
      }

      const originalStart = parseISO(event.startDate);
      const originalEnd = parseISO(event.endDate);
      const originalDuration = originalEnd.getTime() - originalStart.getTime();

      const newStart = new Date(`${newDate}T${newStartTime}:00`);
      if (isNaN(newStart.getTime())) {
        throw new Error(`Invalid date/time: "${newDate}T${newStartTime}". Use YYYY-MM-DD and HH:MM format.`);
      }

      const newEnd = keepDuration
        ? new Date(newStart.getTime() + originalDuration)
        : addHours(newStart, 1);

      const updatedEvent: IEvent = {
        ...event,
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
      };

      setLocalEvents((prev) =>
        prev.map((e) => (e.id === eventId ? updatedEvent : e))
      );

      // Navigate to show the change
      setSelectedDate(newStart);
      router.push(VIEW_ROUTES.day);

      return {
        success: true,
        message: `Rescheduled "${event.title}" from ${format(originalStart, "MMM d 'at' h:mm a")} to ${format(newStart, "MMM d 'at' h:mm a")}. Navigated to day view.`,
        event: {
          id: updatedEvent.id,
          title: updatedEvent.title,
          oldTime: `${format(originalStart, "MMM d, h:mm a")}`,
          newTime: `${format(newStart, "MMM d, h:mm a")}`,
        },
        navigatedTo: "day",
      };
    },
  });
}
