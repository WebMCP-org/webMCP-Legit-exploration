"use client";

import { usePathname } from "next/navigation";
import { useNavigationTools } from "./use-navigation-tools";
import { useEventTools } from "./use-event-tools";
import { useFilterTools } from "./use-filter-tools";
import { useSettingsTools } from "./use-settings-tools";
import { useSmartTools } from "./use-smart-tools";
import { useYearViewTools } from "./use-year-view-tools";
import { useDayViewTools } from "./use-day-view-tools";
import { useHistoryTools } from "./use-history-tools";
import { useAgentTools } from "./use-agent-tools";
import { usePreviewTools } from "./use-preview-tools";

/**
 * This component registers all calendar MCP tools.
 * It must be rendered inside CalendarProvider context.
 * It renders nothing but registers tools via useWebMCP hooks.
 *
 * Tools are organized into:
 * - Global tools: Available on all calendar views
 * - Smart tools: High-level actions that navigate and show results
 * - Legit tools: Version history, undo/rollback, multi-agent coordination
 * - Page-scoped tools: Only available on specific views
 */
export function CalendarMCPTools() {
  const pathname = usePathname();

  // Register global tool categories (available everywhere)
  useNavigationTools();
  useEventTools();
  useFilterTools();
  useSettingsTools();

  // Register smart/high-level tools (available everywhere)
  useSmartTools();

  // Register Legit-powered tools (version history & multi-agent)
  useHistoryTools();
  useAgentTools();
  usePreviewTools();

  return (
    <>
      {/* Page-scoped tools - only register on their respective views */}
      {pathname === "/year-view" && <YearViewToolsRegistrar />}
      {pathname === "/day-view" && <DayViewToolsRegistrar />}
    </>
  );
}

// Separate components to ensure hooks are called at top level
function YearViewToolsRegistrar() {
  useYearViewTools();
  return null;
}

function DayViewToolsRegistrar() {
  useDayViewTools();
  return null;
}
