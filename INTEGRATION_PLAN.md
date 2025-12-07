# WebMCP + Legit Control Integration Plan

## Executive Summary

This document outlines an integration between **WebMCP** (browser-based MCP tool system) and **Legit Control** (versioned filesystem with Git-like capabilities) to enable **safe concurrent multi-agent actions** on web applications.

The calendar demo serves as the proof-of-concept for this integration.

---

## Problem Statement

Current WebMCP tools operate directly on React state:
- State mutations are immediate and irreversible
- Multiple agents operating concurrently can cause conflicts
- No rollback capability if an agent makes a mistake
- No history/audit trail of changes
- No safe "sandbox" for experimental agent actions

---

## Solution Overview

Integrate Legit's versioned filesystem as the state layer for WebMCP tools:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │   Agent A    │     │   Agent B    │     │   Agent C    │   │
│   │  (Claude)    │     │  (GPT-4)     │     │  (Gemini)    │   │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘   │
│          │                    │                    │            │
│          ▼                    ▼                    ▼            │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    WebMCP Tools                          │   │
│   │  calendar_schedule_meeting, calendar_update_event, etc  │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              WebMCP-Legit Bridge Layer                   │   │
│   │  useLegitWebMCP(), LegitWebMCPProvider                  │   │
│   │                                                          │   │
│   │  • Wraps tool handlers with Legit transactions          │   │
│   │  • Each agent operates on its own branch                │   │
│   │  • Merges happen on explicit "commit" action            │   │
│   │  • Conflicts are detected and surfaced to agents        │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Legit SDK                             │   │
│   │  LegitProvider, useLegitFile, operations, branching     │   │
│   │                                                          │   │
│   │  /.legit/branches/                                       │   │
│   │    ├── main/                  (shared truth)            │   │
│   │    ├── agent-claude-abc123/   (Claude's branch)         │   │
│   │    ├── agent-gpt4-def456/     (GPT-4's branch)          │   │
│   │    └── agent-gemini-ghi789/   (Gemini's branch)         │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                React State (CalendarProvider)            │   │
│   │  events, selectedDate, settings, etc                     │   │
│   │                                                          │   │
│   │  • Synced from Legit's current branch                   │   │
│   │  • UI always reflects "checked out" state               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. State as Files
Calendar state is stored as JSON files in Legit's versioned filesystem:
- `/calendar/events.json` - Array of all events
- `/calendar/settings.json` - Badge variant, working hours, visible hours
- `/calendar/filter.json` - Current filter state

### 2. Agent Branches
Each agent operates on its own branch:
- Agent connects → Creates/switches to `agent-{model}-{sessionId}` branch
- Mutations write to this branch
- UI can show "preview" of agent's pending changes
- Explicit merge back to main when user approves

### 3. Operations as Commits
Each MCP tool call creates a Legit "operation":
- Operation = commit with message describing the action
- Full audit trail of what each agent did
- Can rollback to any previous state
- Can diff between states

### 4. Conflict Resolution
When agents try to merge conflicting changes:
- Legit detects conflicts via Git merge-base
- Surface conflict to the user
- Allow manual resolution or auto-resolution strategies

---

## Implementation Phases

### Phase 1: Core Integration Layer

#### New Package: `@webmcp/legit`

```typescript
// src/LegitWebMCPProvider.tsx
import { LegitProvider } from '@legit-sdk/react';
import { WebMCPProvider } from '@mcp-b/react-webmcp';

interface LegitWebMCPProviderProps {
  children: React.ReactNode;
  agentId?: string;  // Optional agent identifier
}

export function LegitWebMCPProvider({ children, agentId }: LegitWebMCPProviderProps) {
  return (
    <LegitProvider config={{ gitRoot: '/', initialBranch: agentId ? `agent-${agentId}` : 'main' }}>
      <WebMCPProvider>
        <LegitWebMCPBridge>
          {children}
        </LegitWebMCPBridge>
      </WebMCPProvider>
    </LegitProvider>
  );
}
```

```typescript
// src/useLegitWebMCP.ts
import { useWebMCP } from '@mcp-b/react-webmcp';
import { useLegitContext } from '@legit-sdk/react';

interface UseLegitWebMCPOptions<T> {
  name: string;
  description: string;
  inputSchema: T;

  // New Legit-specific options
  stateFiles?: string[];              // Which files this tool reads/writes
  mutates?: boolean;                  // Does this tool mutate state?
  autoCommitMessage?: string | ((args: any) => string);  // Commit message template

  handler: (args: any, legit: LegitToolContext) => Promise<any>;
}

interface LegitToolContext {
  readState: <T>(path: string) => Promise<T>;
  writeState: <T>(path: string, data: T) => Promise<void>;
  getCurrentBranch: () => Promise<string>;
  getHistory: () => Promise<HistoryItem[]>;
  rollback: (commitOid: string) => Promise<void>;
}

export function useLegitWebMCP<T>(options: UseLegitWebMCPOptions<T>) {
  const { legitFs, head } = useLegitContext();

  // Wrap the handler to provide Legit context
  const wrappedHandler = async (args: any) => {
    const legitContext: LegitToolContext = {
      readState: async (path) => {
        const content = await legitFs.promises.readFile(path, 'utf8');
        return JSON.parse(content);
      },
      writeState: async (path, data) => {
        await legitFs.promises.writeFile(path, JSON.stringify(data, null, 2));
      },
      getCurrentBranch: () => legitFs.getCurrentBranch(),
      getHistory: async () => {
        const branch = await legitFs.getCurrentBranch();
        const history = await legitFs.promises.readFile(
          `/.legit/branches/${branch}/.legit/history`,
          'utf8'
        );
        return JSON.parse(history);
      },
      rollback: async (oid) => {
        const branch = await legitFs.getCurrentBranch();
        await legitFs.promises.writeFile(
          `/.legit/branches/${branch}/.legit/head`,
          oid
        );
      },
    };

    return options.handler(args, legitContext);
  };

  useWebMCP({
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    annotations: {
      readOnlyHint: !options.mutates,
      idempotentHint: true,
      destructiveHint: false,
    },
    handler: wrappedHandler,
  });
}
```

### Phase 2: Calendar Demo Integration

#### Refactored Calendar State

```typescript
// src/calendar/legit-state/calendar-state.ts

export interface CalendarState {
  events: IEvent[];
  settings: {
    badgeVariant: TBadgeVariant;
    visibleHours: TVisibleHours;
    workingHours: TWorkingHours;
  };
  filter: {
    selectedUserId: string | 'all';
    selectedDate: string;  // ISO date string
  };
}

export const CALENDAR_STATE_PATH = '/calendar/state.json';
```

```typescript
// src/calendar/contexts/legit-calendar-context.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLegitFile } from "@legit-sdk/react";
import type { CalendarState } from "../legit-state/calendar-state";

interface LegitCalendarContext {
  state: CalendarState | null;
  updateState: (updater: (prev: CalendarState) => CalendarState) => Promise<void>;
  loading: boolean;
  error?: Error;

  // Legit-specific
  history: HistoryItem[];
  rollback: (oid: string) => Promise<void>;
  getCurrentBranch: () => Promise<string>;
}

const CalendarContext = createContext<LegitCalendarContext | null>(null);

const INITIAL_STATE: CalendarState = {
  events: [],
  settings: {
    badgeVariant: 'colored',
    visibleHours: { from: 7, to: 18 },
    workingHours: {
      0: { from: 0, to: 0 },
      1: { from: 8, to: 17 },
      // ... etc
    },
  },
  filter: {
    selectedUserId: 'all',
    selectedDate: new Date().toISOString(),
  },
};

export function LegitCalendarProvider({
  children,
  initialEvents,
  users,
}: {
  children: React.ReactNode;
  initialEvents: IEvent[];
  users: IUser[];
}) {
  const {
    data,
    setData,
    history,
    loading,
    error,
    legitFs,
  } = useLegitFile('/calendar/state.json', {
    initialData: JSON.stringify({ ...INITIAL_STATE, events: initialEvents }),
  });

  const state = data ? JSON.parse(data) : null;

  const updateState = async (updater: (prev: CalendarState) => CalendarState) => {
    if (!state) return;
    const newState = updater(state);
    await setData(JSON.stringify(newState, null, 2));
  };

  const rollback = async (oid: string) => {
    if (!legitFs) return;
    const branch = await legitFs.getCurrentBranch();
    await legitFs.promises.writeFile(
      `/.legit/branches/${branch}/.legit/head`,
      oid
    );
  };

  return (
    <CalendarContext.Provider value={{
      state,
      updateState,
      loading,
      error,
      history,
      rollback,
      getCurrentBranch: () => legitFs?.getCurrentBranch() ?? Promise.resolve('main'),
    }}>
      {children}
    </CalendarContext.Provider>
  );
}
```

#### Refactored MCP Tools

```typescript
// src/calendar/mcp-tools/use-legit-event-tools.ts
"use client";

import { useLegitWebMCP } from "@webmcp/legit";
import { z } from "zod";
import { useLegitCalendar } from "../contexts/legit-calendar-context";

export function useLegitEventTools() {
  const { state, updateState, history } = useLegitCalendar();

  // Tool: Create event with automatic versioning
  useLegitWebMCP({
    name: "calendar_schedule_meeting",
    description: "Create a new calendar event (versioned - can be rolled back)",
    stateFiles: ['/calendar/state.json'],
    mutates: true,
    autoCommitMessage: (args) => `Create event: ${args.title}`,
    inputSchema: {
      title: z.string().min(1),
      date: z.string(),
      startTime: z.string(),
      durationMinutes: z.coerce.number().default(60),
      color: z.enum(["blue", "green", "red", "yellow", "purple"]).default("blue"),
    },
    handler: async (args, legit) => {
      const currentState = await legit.readState<CalendarState>('/calendar/state.json');

      const startDate = new Date(`${args.date}T${args.startTime}:00`);
      const endDate = new Date(startDate.getTime() + args.durationMinutes * 60000);

      const newEvent: IEvent = {
        id: Date.now(),
        title: args.title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        color: args.color,
        user: currentState.users?.[0] ?? { id: 'default', name: 'User' },
      };

      await legit.writeState('/calendar/state.json', {
        ...currentState,
        events: [...currentState.events, newEvent],
      });

      return {
        success: true,
        message: `Created "${args.title}" - this change is versioned and can be rolled back`,
        event: newEvent,
        canUndo: true,
        history: await legit.getHistory(),
      };
    },
  });

  // Tool: Undo/rollback
  useLegitWebMCP({
    name: "calendar_undo",
    description: "Undo the last calendar change by rolling back to a previous state",
    mutates: true,
    inputSchema: {
      steps: z.coerce.number().default(1).describe("Number of changes to undo"),
    },
    handler: async (args, legit) => {
      const history = await legit.getHistory();

      if (history.length <= args.steps) {
        throw new Error(`Cannot undo ${args.steps} steps - only ${history.length - 1} changes available`);
      }

      const targetOid = history[args.steps].oid;
      await legit.rollback(targetOid);

      return {
        success: true,
        message: `Rolled back ${args.steps} change(s)`,
        rolledBackTo: history[args.steps].message,
      };
    },
  });

  // Tool: Show history
  useLegitWebMCP({
    name: "calendar_show_history",
    description: "Show the history of calendar changes (who did what, when)",
    mutates: false,
    inputSchema: {
      limit: z.coerce.number().default(10),
    },
    handler: async (args, legit) => {
      const history = await legit.getHistory();

      return {
        changes: history.slice(0, args.limit).map((h, i) => ({
          position: i,
          message: h.message,
          author: h.author.name,
          timestamp: new Date(h.author.timestamp * 1000).toISOString(),
          oid: h.oid,
        })),
        totalChanges: history.length,
        message: `Found ${history.length} changes in history`,
      };
    },
  });
}
```

### Phase 3: Multi-Agent Coordination

#### Agent Branch Management

```typescript
// src/webmcp-legit/multi-agent.ts

interface AgentSession {
  agentId: string;
  modelName: string;
  branch: string;
  createdAt: Date;
  lastActivity: Date;
}

export function useMultiAgentCoordination() {
  const { legitFs } = useLegitContext();
  const [activeSessions, setActiveSessions] = useState<AgentSession[]>([]);

  const createAgentSession = async (agentId: string, modelName: string) => {
    const branchName = `agent-${modelName}-${agentId}`;

    // Fork from main
    await legitFs.promises.writeFile(
      `/.legit/branches/${branchName}/.legit/head`,
      await legitFs.promises.readFile('/.legit/branches/main/.legit/head', 'utf8')
    );

    // Track session
    setActiveSessions(prev => [...prev, {
      agentId,
      modelName,
      branch: branchName,
      createdAt: new Date(),
      lastActivity: new Date(),
    }]);

    return branchName;
  };

  const mergeAgentChanges = async (agentId: string) => {
    const session = activeSessions.find(s => s.agentId === agentId);
    if (!session) throw new Error('Session not found');

    // Check for conflicts
    const mainHead = await legitFs.promises.readFile('/.legit/branches/main/.legit/head', 'utf8');
    const agentHead = await legitFs.promises.readFile(`/.legit/branches/${session.branch}/.legit/head`, 'utf8');

    // Simple merge strategy - in production would need conflict detection
    // For now, just fast-forward main to agent's changes
    await legitFs.promises.writeFile('/.legit/branches/main/.legit/head', agentHead);

    return { success: true, merged: true };
  };

  const getAgentPreview = async (agentId: string) => {
    const session = activeSessions.find(s => s.agentId === agentId);
    if (!session) return null;

    // Read state from agent's branch
    const agentState = await legitFs.promises.readFile(
      `/.legit/branches/${session.branch}/calendar/state.json`,
      'utf8'
    );

    // Read state from main
    const mainState = await legitFs.promises.readFile(
      '/.legit/branches/main/calendar/state.json',
      'utf8'
    );

    // Return diff
    return {
      agentState: JSON.parse(agentState),
      mainState: JSON.parse(mainState),
      hasChanges: agentState !== mainState,
    };
  };

  return {
    activeSessions,
    createAgentSession,
    mergeAgentChanges,
    getAgentPreview,
  };
}
```

#### New Multi-Agent MCP Tools

```typescript
// src/calendar/mcp-tools/use-agent-coordination-tools.ts

export function useAgentCoordinationTools() {
  const { createAgentSession, mergeAgentChanges, getAgentPreview, activeSessions } = useMultiAgentCoordination();

  // Tool: Start isolated session
  useLegitWebMCP({
    name: "calendar_start_sandbox",
    description: "Start an isolated sandbox for making changes. Changes won't affect other agents until merged.",
    mutates: true,
    inputSchema: {
      agentName: z.string().describe("Identifier for this agent session"),
    },
    handler: async (args, legit) => {
      const branch = await createAgentSession(args.agentName, 'claude');

      return {
        success: true,
        message: `Started sandbox session on branch ${branch}`,
        branch,
        tip: "Make changes freely - they won't affect the main calendar until you merge",
      };
    },
  });

  // Tool: Preview pending changes
  useLegitWebMCP({
    name: "calendar_preview_changes",
    description: "Preview what changes this agent would make if merged",
    mutates: false,
    inputSchema: {},
    handler: async (args, legit) => {
      const branch = await legit.getCurrentBranch();
      const preview = await getAgentPreview(branch);

      if (!preview?.hasChanges) {
        return { message: "No pending changes to merge" };
      }

      // Calculate event diffs
      const mainEvents = preview.mainState.events;
      const agentEvents = preview.agentState.events;

      const added = agentEvents.filter(e => !mainEvents.find(m => m.id === e.id));
      const removed = mainEvents.filter(m => !agentEvents.find(e => e.id === m.id));
      const modified = agentEvents.filter(e => {
        const main = mainEvents.find(m => m.id === e.id);
        return main && JSON.stringify(main) !== JSON.stringify(e);
      });

      return {
        hasChanges: true,
        summary: {
          eventsAdded: added.length,
          eventsRemoved: removed.length,
          eventsModified: modified.length,
        },
        details: { added, removed, modified },
      };
    },
  });

  // Tool: Merge changes to main
  useLegitWebMCP({
    name: "calendar_commit_changes",
    description: "Commit your sandbox changes to the main calendar",
    mutates: true,
    inputSchema: {
      message: z.string().describe("Description of the changes being committed"),
    },
    handler: async (args, legit) => {
      const branch = await legit.getCurrentBranch();
      const result = await mergeAgentChanges(branch);

      return {
        success: true,
        message: `Changes committed: ${args.message}`,
        ...result,
      };
    },
  });

  // Tool: See other agents
  useLegitWebMCP({
    name: "calendar_list_agents",
    description: "See what other agents are currently working on the calendar",
    mutates: false,
    inputSchema: {},
    handler: async () => {
      return {
        activeAgents: activeSessions.map(s => ({
          agentId: s.agentId,
          model: s.modelName,
          lastActivity: s.lastActivity.toISOString(),
        })),
        totalAgents: activeSessions.length,
      };
    },
  });
}
```

---

## UI Components

### History Panel

```tsx
// src/components/LegitHistoryPanel.tsx

export function LegitHistoryPanel() {
  const { history, rollback, getCurrentBranch } = useLegitCalendar();
  const [currentBranch, setCurrentBranch] = useState<string>('');

  useEffect(() => {
    getCurrentBranch().then(setCurrentBranch);
  }, []);

  return (
    <div className="legit-history-panel">
      <h3>Change History</h3>
      <p className="text-sm text-gray-500">Branch: {currentBranch}</p>

      <div className="history-list">
        {history.map((item, i) => (
          <div key={item.oid} className="history-item">
            <span className="message">{item.message}</span>
            <span className="author">{item.author.name}</span>
            <span className="time">{formatRelativeTime(item.author.timestamp)}</span>
            {i > 0 && (
              <button onClick={() => rollback(item.oid)}>
                Rollback to here
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Agent Activity Panel

```tsx
// src/components/AgentActivityPanel.tsx

export function AgentActivityPanel() {
  const { activeSessions, getAgentPreview } = useMultiAgentCoordination();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  const handleSelectAgent = async (agentId: string) => {
    setSelectedAgent(agentId);
    const data = await getAgentPreview(agentId);
    setPreview(data);
  };

  return (
    <div className="agent-activity-panel">
      <h3>Active Agents</h3>

      <div className="agent-list">
        {activeSessions.map(session => (
          <div
            key={session.agentId}
            className={`agent-card ${selectedAgent === session.agentId ? 'selected' : ''}`}
            onClick={() => handleSelectAgent(session.agentId)}
          >
            <span className="model">{session.modelName}</span>
            <span className="activity">Last active: {formatRelativeTime(session.lastActivity)}</span>
            {preview?.hasChanges && selectedAgent === session.agentId && (
              <span className="changes-badge">
                {preview.summary.eventsAdded + preview.summary.eventsModified} pending changes
              </span>
            )}
          </div>
        ))}
      </div>

      {preview && (
        <div className="preview-panel">
          <h4>Pending Changes</h4>
          {preview.details.added.map(e => (
            <div key={e.id} className="change added">+ {e.title}</div>
          ))}
          {preview.details.removed.map(e => (
            <div key={e.id} className="change removed">- {e.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## API Summary

### New Packages

| Package | Description |
|---------|-------------|
| `@webmcp/legit` | Core integration layer - `LegitWebMCPProvider`, `useLegitWebMCP` |

### New Hooks

| Hook | Description |
|------|-------------|
| `useLegitWebMCP` | Wrapper around `useWebMCP` that provides Legit context |
| `useLegitCalendar` | Calendar state from Legit filesystem |
| `useMultiAgentCoordination` | Multi-agent branch management |

### New MCP Tools (Calendar Demo)

| Tool | Description |
|------|-------------|
| `calendar_undo` | Rollback N changes |
| `calendar_show_history` | Show change audit trail |
| `calendar_start_sandbox` | Start isolated agent session |
| `calendar_preview_changes` | Preview pending changes |
| `calendar_commit_changes` | Merge sandbox to main |
| `calendar_list_agents` | See active agents |

---

## Benefits

1. **Safe Multi-Agent Concurrency**: Each agent works on its own branch, no conflicts during work
2. **Full Audit Trail**: Every change is a commit with message, author, timestamp
3. **Instant Rollback**: "Undo" becomes trivial - just reset HEAD
4. **Preview Before Merge**: See what an agent did before accepting changes
5. **Conflict Detection**: Know when agents made conflicting changes
6. **Agent Isolation**: Experimental agents can't corrupt shared state

---

## Demo Scenario

1. User opens calendar app
2. Claude agent starts sandbox → creates `agent-claude-session1` branch
3. Claude schedules 3 meetings
4. GPT-4 agent starts sandbox → creates `agent-gpt4-session2` branch
5. GPT-4 reschedules an existing meeting
6. User can see both agents' pending changes in UI
7. User approves Claude's changes → merged to main
8. GPT-4's branch now shows conflict (base changed)
9. User can either:
   - Auto-rebase GPT-4's changes onto new main
   - Reject GPT-4's changes
   - Manually resolve

---

## Next Steps

1. [ ] Create `@webmcp/legit` package in WebMCP monorepo
2. [ ] Implement `useLegitWebMCP` hook
3. [ ] Refactor calendar to use Legit state
4. [ ] Implement multi-agent coordination
5. [ ] Build UI components for history/agents
6. [ ] Create demo video showing multi-agent scenario
7. [ ] Write documentation

---

## Questions for Legit Team

1. **Branch creation API**: What's the cleanest way to create a branch from a specific commit?
2. **Merge strategies**: Does Legit have built-in merge conflict resolution?
3. **Real-time sync**: Can we get WebSocket updates when another branch changes?
4. **Performance**: What's the overhead of branch-per-agent at scale (100+ agents)?
5. **Server sync**: How does the sync service handle branch proliferation?
