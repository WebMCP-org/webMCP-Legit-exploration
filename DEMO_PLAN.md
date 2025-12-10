# WebMCP + Legit Demo Plan

## Vision

Demonstrate how AI agents can safely interact with applications through WebMCP while Legit provides:
- **Observable changes** - Users see exactly what the AI is doing
- **Approval workflows** - Changes require human approval before committing
- **Rollback safety** - Any change can be undone
- **Multi-agent isolation** - Multiple AIs can work without conflicts

---

## Phase 1: Phantom Events (Agent Preview UI)

### Concept
When an agent makes changes on their branch, show those changes as "phantom" events on the calendar - visually distinct, clearly labeled as pending approval.

### Implementation

#### 1.1 Phantom Event Styling
Add new visual treatment for uncommitted agent changes:

```typescript
// New color variant in event-block.tsx
const phantomStyles = {
  base: "border-dashed border-2 opacity-70",
  pending: "bg-gradient-to-r from-purple-50/50 to-blue-50/50 border-purple-300",
  added: "border-green-400 bg-green-50/30",
  modified: "border-amber-400 bg-amber-50/30",
  removed: "border-red-400 bg-red-50/30 line-through opacity-50"
}
```

#### 1.2 Agent Preview Context
New context to track which agent branch is being previewed:

```typescript
interface AgentPreviewState {
  isPreviewMode: boolean;
  agentId: string | null;
  agentBranch: string | null;
  pendingChanges: {
    added: IEvent[];
    modified: { before: IEvent; after: IEvent }[];
    removed: IEvent[];
  };
}
```

#### 1.3 Combined Event List
Merge main branch events with phantom events from agent branch:

```typescript
function useCombinedEvents() {
  const { events } = useCalendar(); // main branch
  const { pendingChanges, isPreviewMode } = useAgentPreview();

  if (!isPreviewMode) return events;

  return [
    ...events.filter(e => !pendingChanges.removed.some(r => r.id === e.id)),
    ...pendingChanges.added.map(e => ({ ...e, _phantom: 'added' })),
    ...pendingChanges.modified.map(m => ({ ...m.after, _phantom: 'modified' })),
    ...pendingChanges.removed.map(e => ({ ...e, _phantom: 'removed' })),
  ];
}
```

#### 1.4 UI Components
- **Phantom Event Badge**: Shows "AI Pending" label with agent icon
- **Preview Banner**: Top bar showing "Previewing changes from Claude" with Accept/Reject buttons
- **Change Summary Panel**: Sidebar showing diff summary

---

## Phase 2: Approval Workflow UI

### Concept
A clear workflow for reviewing and approving AI-proposed changes.

### Implementation

#### 2.1 Approval Panel Component
Slide-out panel showing:
- Agent identity (which AI made changes)
- Timestamp of changes
- Summary: "+3 events, ~2 modified, -1 removed"
- Detailed diff view
- Accept All / Reject All / Review Individual buttons

#### 2.2 Individual Change Review
Click on a phantom event to see:
- Before/After comparison (for modifications)
- Full event details
- Accept / Reject this change buttons

#### 2.3 MCP Tools for Approval Flow
```typescript
// Tool for AI to check if its changes were approved
calendar_check_approval_status: {
  input: { agentId: string },
  output: {
    status: 'pending' | 'approved' | 'rejected' | 'partial',
    approvedChanges: string[],
    rejectedChanges: string[],
    feedback?: string
  }
}

// Tool for AI to request approval
calendar_request_approval: {
  input: {
    agentId: string,
    message: string,  // "I've scheduled 3 meetings for next week"
    priority: 'normal' | 'urgent'
  },
  output: { requestId: string, notificationSent: boolean }
}
```

---

## Phase 3: Real-time Agent Activity Feed

### Concept
Show a live feed of what agents are doing, providing transparency into AI actions.

### Implementation

#### 3.1 Activity Feed Component
```typescript
interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  action: 'tool_call' | 'state_change' | 'branch_created' | 'merge_requested';
  toolName?: string;
  description: string;
  timestamp: Date;
  details?: unknown;
}
```

#### 3.2 Activity Sidebar
- Collapsible sidebar showing recent agent activity
- Filter by agent
- Click to see full details
- "Jump to change" button to navigate to affected events

#### 3.3 MCP Tool Hooks
Instrument all MCP tools to emit activity events:
```typescript
function useInstrumentedWebMCP(options) {
  const emitActivity = useActivityFeed();

  return useWebMCP({
    ...options,
    handler: async (args) => {
      emitActivity({ action: 'tool_call', toolName: options.name, ... });
      const result = await options.handler(args);
      emitActivity({ action: 'state_change', ... });
      return result;
    }
  });
}
```

---

## Phase 4: Conflict Resolution UI

### Concept
When multiple agents (or agent + human) make conflicting changes, provide clear conflict resolution.

### Implementation

#### 4.1 Conflict Detection
```typescript
interface Conflict {
  type: 'time_overlap' | 'same_event_modified' | 'deleted_then_modified';
  eventId: number;
  agents: string[];
  description: string;
  resolutions: ConflictResolution[];
}

interface ConflictResolution {
  label: string;
  description: string;
  apply: () => Promise<void>;
}
```

#### 4.2 Conflict UI
- Banner: "2 conflicts detected between your changes and Claude's"
- Visual highlighting of conflicting events
- Side-by-side comparison
- Resolution options: Keep mine / Keep AI's / Merge / Custom

#### 4.3 Smart Merge Tool
```typescript
calendar_smart_merge: {
  description: "Attempt to automatically merge non-conflicting changes from an agent branch",
  input: { agentId: string, strategy: 'theirs' | 'ours' | 'smart' },
  output: {
    merged: number,
    conflicts: Conflict[],
    requiresManualResolution: boolean
  }
}
```

---

## Phase 5: Time Travel / Version Explorer

### Concept
Interactive UI to explore calendar history, see what changed when, and restore past states.

### Implementation

#### 5.1 Timeline Scrubber
- Horizontal timeline showing commits
- Drag to see calendar at any point in time
- Commit metadata on hover (author, message, timestamp)

#### 5.2 Diff Visualization
- Toggle to show "what changed" overlay
- Green highlights for additions
- Red strikethrough for deletions
- Yellow background for modifications

#### 5.3 Restore Functionality
- "Restore this version" button
- Selective restore: restore individual events from past
- Creates new commit (doesn't lose history)

---

## Phase 6: Multi-Agent Dashboard

### Concept
Central view for managing multiple AI agents working on the calendar.

### Implementation

#### 6.1 Agent Cards
For each active agent show:
- Agent name/model
- Branch name
- Last activity timestamp
- Pending changes count
- Quick actions: Preview / Merge / Discard

#### 6.2 Agent Comparison View
- Select 2+ agents to compare their proposed changes
- Side-by-side calendar views
- Merge selector: pick changes from each

#### 6.3 Agent Permissions (Future)
```typescript
interface AgentPermissions {
  canCreate: boolean;
  canModify: boolean;
  canDelete: boolean;
  maxEventsPerSession: number;
  requiresApproval: boolean;
  allowedTimeRanges?: { start: string; end: string }[];
}
```

---

## Demo Scenarios

### Scenario 1: Basic Agent Approval Flow
1. User asks Claude to "schedule a team standup every day at 9am"
2. Claude creates a sandbox, adds 5 recurring events
3. Events appear as phantoms on calendar with "Pending Approval" badges
4. User reviews in approval panel, sees all 5 events
5. User approves, events become solid/permanent

### Scenario 2: Conflict Resolution
1. Human manually adds meeting on Tuesday 2pm
2. Claude (unaware) schedules a call for Tuesday 2pm
3. UI shows conflict banner
4. User chooses to keep Claude's suggestion, moves their meeting

### Scenario 3: Multi-Agent Coordination
1. Claude-1 is scheduling meetings for Project A
2. Claude-2 is scheduling meetings for Project B
3. Dashboard shows both agents' pending changes
4. User can compare and merge selectively

### Scenario 4: Time Travel Recovery
1. Agent accidentally deletes important recurring meeting
2. User notices next day
3. Uses timeline to find the meeting in history
4. Restores just that event from 2 days ago

### Scenario 5: Real-time Observation
1. User watches activity feed as Claude schedules meetings
2. Sees each tool call: "list_events", "find_free_time", "schedule_meeting"
3. Can intervene mid-process if Claude makes wrong assumptions

---

## Technical Architecture

### State Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  WebMCP     │────▶│   Legit     │────▶│    React    │
│  Tool Call  │     │  Commit     │     │   Context   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Branch     │
                    │  Isolation  │
                    └─────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │    Main     │          │   Agent     │
       │   Branch    │          │   Branch    │
       └─────────────┘          └─────────────┘
              │                         │
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │   Solid     │          │  Phantom    │
       │   Events    │          │   Events    │
       └─────────────┘          └─────────────┘
```

### Key Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/calendar/context/agent-preview-context.tsx` | Agent preview state management |
| `src/calendar/components/phantom-event-badge.tsx` | Phantom event visual treatment |
| `src/calendar/components/approval-panel.tsx` | Change approval UI |
| `src/calendar/components/activity-feed.tsx` | Real-time agent activity |
| `src/calendar/components/conflict-resolver.tsx` | Conflict resolution UI |
| `src/calendar/components/time-travel.tsx` | History explorer |
| `src/calendar/hooks/use-combined-events.ts` | Merge main + phantom events |
| `src/calendar/hooks/use-agent-preview.ts` | Agent preview logic |

---

## Implementation Priority

### MVP (Phase 1 + 2) - High Impact Demo
1. **Phantom events** - Visual distinction for pending changes
2. **Preview banner** - Clear indication of preview mode
3. **Simple approval** - Accept/Reject all changes

### V2 (Phase 3 + 5) - Enhanced Observability
4. **Activity feed** - Real-time transparency
5. **Timeline scrubber** - History exploration

### V3 (Phase 4 + 6) - Advanced Multi-Agent
6. **Conflict resolution** - Handle concurrent edits
7. **Multi-agent dashboard** - Manage multiple AIs

---

## Success Metrics

A successful demo should show:

1. **Transparency** - User always knows what AI is doing
2. **Control** - User can approve/reject any AI action
3. **Safety** - Any change can be undone
4. **Collaboration** - Multiple agents can work together
5. **Trust** - Build confidence in AI-assisted workflows
