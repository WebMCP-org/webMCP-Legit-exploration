"use client";

import { usePathname } from "next/navigation";
import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";
import { useCalendar } from "@/calendar/contexts/calendar-context";

export function useFilterTools() {
  const pathname = usePathname();
  const {
    users,
    selectedUserId,
    setSelectedUserId,
    selectedDate,
    badgeVariant,
    visibleHours,
    workingHours,
  } = useCalendar();

  // Consolidated state getter - combines get_current_view, get_settings, get_current_filter, list_users
  useWebMCP({
    name: "calendar_get_state",
    description: `Get the current calendar state including view, date, filter, settings, and available users. Use this to understand the current context before making changes.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async () => {
      const currentView = pathname?.replace("-view", "").replace("/", "") || "month";
      const currentUser =
        selectedUserId === "all"
          ? null
          : users.find((u) => u.id === selectedUserId);

      return {
        // Current view and date
        currentView,
        selectedDate: selectedDate.toISOString(),

        // User filter
        filter: {
          userId: selectedUserId,
          userName: currentUser?.name || "All Users",
          isFiltered: selectedUserId !== "all",
        },

        // Display settings
        settings: {
          badgeVariant,
          visibleHours,
          workingHours,
        },

        // Available users (for filtering/event assignment)
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
        })),
      };
    },
  });

  // Tool: Filter events by user (keep as separate since it's a common action)
  useWebMCP({
    name: "calendar_filter_by_user",
    description:
      "Filter calendar events to show only events for a specific user, or 'all' to show everyone. The view updates immediately to reflect the filter.",
    inputSchema: {
      userId: z
        .string()
        .describe("User ID to filter by, or 'all' to show all users. Get user IDs from calendar_get_state."),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ userId }) => {
      if (userId !== "all") {
        const user = users.find((u) => u.id === userId);
        if (!user) {
          throw new Error(
            `User with ID "${userId}" not found. Use calendar_get_state to see available users.`
          );
        }
      }

      setSelectedUserId(userId);

      const userName = userId === "all"
        ? "all users"
        : users.find((u) => u.id === userId)?.name;

      return {
        success: true,
        message: `Now showing events for ${userName}`,
        currentFilter: userId,
      };
    },
  });
}
