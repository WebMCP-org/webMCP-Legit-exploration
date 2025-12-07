"use client";

import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import type { TBadgeVariant, TVisibleHours } from "@/calendar/types";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function useSettingsTools() {
  const {
    badgeVariant,
    setBadgeVariant,
    visibleHours,
    setVisibleHours,
    workingHours,
    setWorkingHours,
  } = useCalendar();

  // Consolidated settings tool - update one or more settings at once
  useWebMCP({
    name: "calendar_update_settings",
    description: `Update calendar display settings. All parameters are optional - only provide what you want to change.

Settings you can modify:
- badgeVariant: How events appear ('dot', 'colored', 'mixed')
- visibleHours: Time range shown in day/week views
- workingHours: Working hours for a specific day (affects visual styling)`,
    inputSchema: {
      badgeVariant: z
        .enum(["dot", "colored", "mixed"])
        .optional()
        .describe("Badge display style: 'dot' shows small dots, 'colored' shows full colored badges, 'mixed' combines both"),
      visibleHours: z
        .object({
          from: z.coerce.number().min(0).max(23).describe("Start hour (0-23)"),
          to: z.coerce.number().min(1).max(24).describe("End hour (1-24)"),
        })
        .optional()
        .describe("Time range visible in day/week views"),
      workingHours: z
        .object({
          dayOfWeek: z.coerce.number().min(0).max(6).describe("Day of week (0=Sunday, 6=Saturday)"),
          from: z.coerce.number().min(0).max(23).describe("Work start hour (0-23), or 0 if not a working day"),
          to: z.coerce.number().min(0).max(24).describe("Work end hour (0-24), or 0 if not a working day"),
        })
        .optional()
        .describe("Set working hours for a specific day"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: async ({ badgeVariant: newBadgeVariant, visibleHours: newVisibleHours, workingHours: newWorkingHours }) => {
      const changes: string[] = [];

      // Update badge variant
      if (newBadgeVariant) {
        setBadgeVariant(newBadgeVariant as TBadgeVariant);
        changes.push(`Badge variant set to "${newBadgeVariant}"`);
      }

      // Update visible hours
      if (newVisibleHours) {
        if (newVisibleHours.from >= newVisibleHours.to) {
          throw new Error("Start hour must be before end hour");
        }
        setVisibleHours(newVisibleHours as TVisibleHours);
        changes.push(`Visible hours set to ${newVisibleHours.from}:00 - ${newVisibleHours.to}:00`);
      }

      // Update working hours for a specific day
      if (newWorkingHours) {
        const { dayOfWeek, from, to } = newWorkingHours;
        setWorkingHours((prev) => ({
          ...prev,
          [dayOfWeek]: { from, to },
        }));
        const isWorkingDay = from > 0 || to > 0;
        changes.push(
          isWorkingDay
            ? `${DAY_NAMES[dayOfWeek]} working hours set to ${from}:00 - ${to}:00`
            : `${DAY_NAMES[dayOfWeek]} marked as non-working day`
        );
      }

      if (changes.length === 0) {
        return {
          success: false,
          message: "No settings were changed. Provide at least one setting to update.",
        };
      }

      return {
        success: true,
        message: changes.join(". "),
        currentSettings: {
          badgeVariant: newBadgeVariant || badgeVariant,
          visibleHours: newVisibleHours || visibleHours,
          workingHours,
        },
      };
    },
  });
}
