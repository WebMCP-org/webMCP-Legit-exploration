"use client";

import type { HistoryItem } from "@legit-sdk/core";
import type { IEvent, IUser } from "@/calendar/interfaces";
import type { TBadgeVariant, TVisibleHours, TWorkingHours } from "@/calendar/types";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Context provided to Legit-enabled MCP tool handlers.
 * Provides versioned state operations backed by Legit's git-like filesystem.
 */
export interface LegitToolContext {
  /**
   * Read JSON state from a Legit-versioned file.
   * @param path - Path relative to branch root (e.g., "/calendar/events.json")
   * @returns Parsed JSON data
   */
  readState: <T>(path: string) => Promise<T>;

  /**
   * Write JSON state to a Legit-versioned file.
   * Creates a new commit in the current branch.
   * @param path - Path relative to branch root
   * @param data - Data to write (will be JSON stringified)
   */
  writeState: <T>(path: string, data: T) => Promise<void>;

  /**
   * Get the current branch name.
   * @returns Branch name (e.g., "anonymous", "main", "agent-claude-xyz")
   */
  getCurrentBranch: () => Promise<string>;

  /**
   * Get the commit history for the current branch.
   * @returns Array of history items with commit metadata
   */
  getHistory: () => Promise<HistoryItem[]>;

  /**
   * Rollback the current branch to a specific commit.
   * @param commitOid - The commit hash to rollback to
   */
  rollback: (commitOid: string) => Promise<void>;

  /**
   * Get state at a specific commit.
   * @param commitOid - The commit hash
   * @param path - Path to the file
   * @returns Parsed JSON data from that commit
   */
  getPastState: <T>(commitOid: string, path: string) => Promise<T>;
}

/**
 * Represents an active agent session with its own isolated branch.
 * Each agent operates on a separate git branch to enable concurrent editing.
 */
export interface AgentSession {
  /** Unique identifier for this agent session */
  agentId: string;
  /** AI model name (e.g., "claude", "gpt4") */
  modelName: string;
  /** Git branch name for this agent's work */
  branch: string;
  /** When the session was created */
  createdAt: Date;
  /** When the agent last made a change */
  lastActivity: Date;
}

/**
 * Preview of changes an agent has made compared to the main branch.
 */
export interface AgentPreview {
  /** Whether the agent has any pending changes */
  hasChanges: boolean;
  /** Current state on the agent's branch */
  agentState: unknown;
  /** Current state on the main branch */
  mainState: unknown;
  /** Summary of changes */
  summary?: {
    eventsAdded: number;
    eventsRemoved: number;
    eventsModified: number;
  };
}

// =============================================================================
// Calendar-Specific Types
// =============================================================================

/**
 * Complete calendar state stored in Legit filesystem.
 */
export interface CalendarLegitState {
  events: IEvent[];
  users: IUser[];
  settings: {
    badgeVariant: TBadgeVariant;
    visibleHours: TVisibleHours;
    workingHours: TWorkingHours;
  };
  filter: {
    selectedUserId: string | "all";
    selectedDate: string;
  };
}

/**
 * Standard paths for calendar state files in Legit filesystem.
 */
export const CALENDAR_PATHS = {
  EVENTS: "/calendar/events.json",
  USERS: "/calendar/users.json",
  SETTINGS: "/calendar/settings.json",
} as const;
