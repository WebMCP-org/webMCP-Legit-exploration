"use client";

import { useRouter } from "next/navigation";
import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import type { IEvent } from "@/calendar/interfaces";
import type { TEventColor } from "@/calendar/types";
import { format, parseISO } from "date-fns";

export function useEventTools() {
  const router = useRouter();
  const { events, setLocalEvents, users, setSelectedDate } = useCalendar();

  // Tool: List events
  useWebMCP({
    name: "calendar_list_events",
    description:
      "List all calendar events, optionally filtered by date range or user. Returns event IDs needed for get/update/delete operations.",
    inputSchema: {
      startDate: z
        .string()
        .optional()
        .describe("Filter events starting from this date (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter events ending before this date (YYYY-MM-DD)"),
      userId: z.string().optional().describe("Filter events by user ID"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ startDate, endDate, userId }) => {
      let filteredEvents = [...events];

      if (startDate) {
        const start = new Date(startDate);
        filteredEvents = filteredEvents.filter(
          (e) => new Date(e.endDate) >= start
        );
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredEvents = filteredEvents.filter(
          (e) => new Date(e.startDate) <= end
        );
      }

      if (userId) {
        filteredEvents = filteredEvents.filter((e) => e.user.id === userId);
      }

      return {
        events: filteredEvents.map((e) => ({
          id: e.id,
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          color: e.color,
          user: e.user.name,
          description: e.description,
        })),
        count: filteredEvents.length,
      };
    },
  });

  // Tool: Get event details
  useWebMCP({
    name: "calendar_get_event",
    description: "Get detailed information about a specific event by ID",
    inputSchema: {
      eventId: z.coerce.number().describe("The ID of the event to retrieve"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ eventId }) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        throw new Error(`Event with ID ${eventId} not found`);
      }
      return { event };
    },
  });

  // Tool: Update event - now navigates to show the result
  useWebMCP({
    name: "calendar_update_event",
    description:
      "Update an existing calendar event and navigate to show the change. Provide only the fields you want to change.",
    inputSchema: {
      eventId: z.coerce.number().describe("The ID of the event to update"),
      title: z.string().optional().describe("New event title"),
      description: z.string().optional().describe("New event description"),
      startDate: z
        .string()
        .optional()
        .describe("New start date/time (ISO format or 'YYYY-MM-DDTHH:MM')"),
      endDate: z
        .string()
        .optional()
        .describe("New end date/time (ISO format or 'YYYY-MM-DDTHH:MM')"),
      color: z
        .enum(["blue", "green", "red", "yellow", "purple", "orange", "gray"])
        .optional()
        .describe("New event color"),
      userId: z.string().optional().describe("New user ID"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ eventId, ...updates }) => {
      const eventIndex = events.findIndex((e) => e.id === eventId);
      if (eventIndex === -1) {
        throw new Error(`Event with ID ${eventId} not found`);
      }

      const existingEvent = events[eventIndex];
      let updatedUser = existingEvent.user;

      if (updates.userId) {
        const user = users.find((u) => u.id === updates.userId);
        if (!user) {
          throw new Error(`User with ID ${updates.userId} not found`);
        }
        updatedUser = user;
      }

      const updatedEvent: IEvent = {
        ...existingEvent,
        ...(updates.title && { title: updates.title }),
        ...(updates.description && { description: updates.description }),
        ...(updates.startDate && { startDate: updates.startDate }),
        ...(updates.endDate && { endDate: updates.endDate }),
        ...(updates.color && { color: updates.color as TEventColor }),
        user: updatedUser,
      };

      setLocalEvents((prev) => {
        const newEvents = [...prev];
        const idx = newEvents.findIndex((e) => e.id === eventId);
        if (idx !== -1) {
          newEvents[idx] = updatedEvent;
        }
        return newEvents;
      });

      // Navigate to show the updated event
      const eventDate = parseISO(updatedEvent.startDate);
      setSelectedDate(eventDate);
      router.push("/day-view");

      return {
        success: true,
        message: `Event "${updatedEvent.title}" updated. Navigated to ${format(eventDate, "MMM d")} to show the change.`,
        event: {
          id: updatedEvent.id,
          title: updatedEvent.title,
          startDate: updatedEvent.startDate,
          endDate: updatedEvent.endDate,
          color: updatedEvent.color,
          user: updatedEvent.user.name,
        },
        navigatedTo: "day",
      };
    },
  });

  // Tool: Delete event - now navigates to show the result
  useWebMCP({
    name: "calendar_delete_event",
    description:
      "Delete a calendar event by ID and navigate to show the day (confirming removal).",
    inputSchema: {
      eventId: z.coerce.number().describe("The ID of the event to delete"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: true,
    },
    handler: async ({ eventId }) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        throw new Error(`Event with ID ${eventId} not found`);
      }

      const eventDate = parseISO(event.startDate);

      setLocalEvents((prev) => prev.filter((e) => e.id !== eventId));

      // Navigate to show the day (event will be gone)
      setSelectedDate(eventDate);
      router.push("/day-view");

      return {
        success: true,
        message: `Event "${event.title}" deleted. Navigated to ${format(eventDate, "MMM d")} to confirm removal.`,
        deletedEvent: {
          id: eventId,
          title: event.title,
          wasScheduledFor: format(eventDate, "EEEE, MMMM d 'at' h:mm a"),
        },
        navigatedTo: "day",
      };
    },
  });
}
