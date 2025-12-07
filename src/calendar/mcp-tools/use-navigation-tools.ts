"use client";

import { useRouter, usePathname } from "next/navigation";
import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import type { TCalendarView } from "@/calendar/types";

const VIEW_ROUTES: Record<TCalendarView, string> = {
  day: "/day-view",
  week: "/week-view",
  month: "/month-view",
  year: "/year-view",
  agenda: "/agenda-view",
};

export function useNavigationTools() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedDate, setSelectedDate } = useCalendar();

  // Consolidated navigation tool
  useWebMCP({
    name: "calendar_navigate",
    description: `Navigate the calendar to a specific view, date, or today. Can combine view and date in one call.

View-specific tools become available when you navigate:
- Day view: Tools for hourly breakdown, day summary, finding conflicts
- Year view: Tools for yearly summaries, month comparisons, finding busy/quiet periods

Examples:
- Show today in week view: { "view": "week", "today": true }
- Go to specific date: { "date": "2025-12-25" }
- Switch to year view: { "view": "year" }`,
    inputSchema: {
      view: z
        .enum(["day", "week", "month", "year", "agenda"])
        .optional()
        .describe("Calendar view to switch to"),
      date: z
        .string()
        .optional()
        .describe("Date to navigate to (YYYY-MM-DD format, e.g., '2025-12-08')"),
      today: z.coerce
        .boolean()
        .optional()
        .describe("Set to true to navigate to today's date"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ view, date, today }) => {
      let targetDate = selectedDate;

      // Handle date navigation
      if (today) {
        targetDate = new Date();
        setSelectedDate(targetDate);
      } else if (date) {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          throw new Error(`Invalid date format: "${date}". Use YYYY-MM-DD format.`);
        }
        targetDate = parsedDate;
        setSelectedDate(targetDate);
      }

      // Handle view navigation
      if (view) {
        router.push(VIEW_ROUTES[view]);
      }

      const currentView = view || pathname?.replace("-view", "").replace("/", "") || "month";

      return {
        success: true,
        message: `Navigated to ${targetDate.toDateString()}${view ? ` in ${view} view` : ""}`,
        currentView,
        selectedDate: targetDate.toISOString(),
        availableTools: getViewSpecificToolsHint(currentView as TCalendarView),
      };
    },
  });
}

function getViewSpecificToolsHint(view: TCalendarView): string {
  switch (view) {
    case "day":
      return "Day view tools now available: hourly breakdown, day summary, find conflicts, navigate between days";
    case "year":
      return "Year view tools now available: yearly summary, compare months, find busiest/quietest periods, jump to month";
    default:
      return "Standard calendar tools available";
  }
}
