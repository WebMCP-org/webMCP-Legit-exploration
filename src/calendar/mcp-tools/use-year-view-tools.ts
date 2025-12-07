"use client";

import { useRouter } from "next/navigation";
import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  parseISO,
  areIntervalsOverlapping,
} from "date-fns";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Tools specific to the year view - scoped to only appear on year-view page
 */
export function useYearViewTools() {
  const router = useRouter();
  const { events, selectedDate, setSelectedDate } = useCalendar();

  // Tool: Get year overview/summary
  useWebMCP({
    name: "yearview_get_summary",
    description:
      "Get a summary of events for the entire year, broken down by month. Only available in year view.",
    inputSchema: {
      year: z.coerce
        .number()
        .optional()
        .describe("Year to summarize (defaults to currently viewed year)"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ year }) => {
      const targetYear = year || selectedDate.getFullYear();
      const yearStart = startOfYear(new Date(targetYear, 0, 1));
      const yearEnd = endOfYear(yearStart);

      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      const monthSummaries = months.map((monthDate) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthEvents = events.filter((e) => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          return areIntervalsOverlapping(
            { start: eventStart, end: eventEnd },
            { start: monthStart, end: monthEnd }
          );
        });

        // Count by user
        const userCounts: Record<string, number> = {};
        monthEvents.forEach((e) => {
          userCounts[e.user.name] = (userCounts[e.user.name] || 0) + 1;
        });

        return {
          month: format(monthDate, "MMMM"),
          monthNumber: monthDate.getMonth() + 1,
          eventCount: monthEvents.length,
          topUsers: Object.entries(userCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name, count]) => ({ name, count })),
        };
      });

      const totalEvents = monthSummaries.reduce((sum, m) => sum + m.eventCount, 0);
      const busiestMonth = monthSummaries.reduce((max, m) =>
        m.eventCount > max.eventCount ? m : max
      );

      return {
        year: targetYear,
        totalEvents,
        busiestMonth: {
          name: busiestMonth.month,
          eventCount: busiestMonth.eventCount,
        },
        monthBreakdown: monthSummaries,
        message: `Year ${targetYear} has ${totalEvents} events. Busiest month: ${busiestMonth.month} with ${busiestMonth.eventCount} events.`,
      };
    },
  });

  // Tool: Jump to a specific month from year view
  useWebMCP({
    name: "yearview_jump_to_month",
    description:
      "Jump from year view to a specific month in month view. Only available in year view.",
    inputSchema: {
      month: z.coerce
        .number()
        .min(1)
        .max(12)
        .describe("Month number (1-12, e.g., 1=January, 12=December)"),
      year: z.coerce
        .number()
        .optional()
        .describe("Year (defaults to currently viewed year)"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ month, year }) => {
      const targetYear = year || selectedDate.getFullYear();
      const targetDate = new Date(targetYear, month - 1, 1);

      setSelectedDate(targetDate);
      router.push("/month-view");

      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const monthEvents = events.filter((e) => {
        const eventStart = parseISO(e.startDate);
        const eventEnd = parseISO(e.endDate);
        return areIntervalsOverlapping(
          { start: eventStart, end: eventEnd },
          { start: monthStart, end: monthEnd }
        );
      });

      return {
        success: true,
        message: `Jumped to ${MONTH_NAMES[month - 1]} ${targetYear} with ${monthEvents.length} events.`,
        month: MONTH_NAMES[month - 1],
        year: targetYear,
        eventCount: monthEvents.length,
        navigatedTo: "month",
      };
    },
  });

  // Tool: Compare months in the year
  useWebMCP({
    name: "yearview_compare_months",
    description:
      "Compare event distribution across months in the current year. Only available in year view.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async () => {
      const targetYear = selectedDate.getFullYear();
      const yearStart = startOfYear(new Date(targetYear, 0, 1));
      const yearEnd = endOfYear(yearStart);

      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      const comparison = months.map((monthDate) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthEvents = events.filter((e) => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          return areIntervalsOverlapping(
            { start: eventStart, end: eventEnd },
            { start: monthStart, end: monthEnd }
          );
        });

        return {
          month: format(monthDate, "MMM"),
          events: monthEvents.length,
          bar: "█".repeat(Math.min(monthEvents.length, 20)),
        };
      });

      const max = Math.max(...comparison.map((c) => c.events));
      const min = Math.min(...comparison.map((c) => c.events));
      const avg = comparison.reduce((sum, c) => sum + c.events, 0) / 12;

      return {
        year: targetYear,
        comparison,
        stats: {
          max,
          min,
          average: Math.round(avg * 10) / 10,
        },
        message: `Event comparison for ${targetYear}: Max ${max}, Min ${min}, Avg ${avg.toFixed(1)} events/month.`,
      };
    },
  });

  // Tool: Find quietest/busiest periods
  useWebMCP({
    name: "yearview_find_periods",
    description:
      "Find the busiest and quietest periods in the year. Only available in year view.",
    inputSchema: {
      type: z
        .enum(["busiest", "quietest"])
        .describe("Type of period to find"),
      count: z.coerce
        .number()
        .default(3)
        .describe("Number of periods to return (default: 3)"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ type, count }) => {
      const targetYear = selectedDate.getFullYear();
      const yearStart = startOfYear(new Date(targetYear, 0, 1));
      const yearEnd = endOfYear(yearStart);

      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      const monthData = months.map((monthDate) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthEvents = events.filter((e) => {
          const eventStart = parseISO(e.startDate);
          const eventEnd = parseISO(e.endDate);
          return areIntervalsOverlapping(
            { start: eventStart, end: eventEnd },
            { start: monthStart, end: monthEnd }
          );
        });

        return {
          month: format(monthDate, "MMMM yyyy"),
          monthNumber: monthDate.getMonth() + 1,
          eventCount: monthEvents.length,
        };
      });

      const sorted =
        type === "busiest"
          ? monthData.sort((a, b) => b.eventCount - a.eventCount)
          : monthData.sort((a, b) => a.eventCount - b.eventCount);

      const results = sorted.slice(0, count);

      return {
        type,
        year: targetYear,
        periods: results,
        message: `${type === "busiest" ? "Busiest" : "Quietest"} ${count} months in ${targetYear}: ${results.map((r) => `${r.month} (${r.eventCount})`).join(", ")}.`,
      };
    },
  });
}
