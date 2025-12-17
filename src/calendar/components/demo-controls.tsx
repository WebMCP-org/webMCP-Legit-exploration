"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Bot,
  RotateCcw,
  Play,
  CheckCircle2,
  Sparkles,
  X,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMultiAgentCoordination } from "@/legit-webmcp";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import { useAgentPreview } from "@/calendar/contexts/agent-preview-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/calendar/interfaces";
import { addDays, setHours, setMinutes } from "date-fns";

export interface DemoControlsRef {
  openAndRunDemo: () => void;
}

// Step configuration with icons and descriptions
interface StepConfig {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
}

const DEMO_STEPS: StepConfig[] = [
  {
    icon: Bot,
    iconColor: "text-primary",
    title: "AI analyzing calendar",
    description: "Scanning your schedule for conflicts...",
  },
  {
    icon: Plus,
    iconColor: "text-green-500",
    title: "Adding new meetings",
    description: "AI suggests a new meeting",
  },
  {
    icon: Pencil,
    iconColor: "text-amber-500",
    title: "Rescheduling conflicts",
    description: "AI adjusts an existing event",
  },
  {
    icon: Trash2,
    iconColor: "text-red-500",
    title: "Removing cancelled event",
    description: "AI proposes removing a meeting",
  },
  {
    icon: CheckCircle2,
    iconColor: "text-primary",
    title: "Ready for your review!",
    description: "You decide what to keep or discard",
  },
];

/**
 * Demo Control Panel
 * Showcases AI calendar scheduling with conflicts and user approval
 */
export const DemoControls = forwardRef<DemoControlsRef>(function DemoControls(_, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [showPulse, setShowPulse] = useState(true);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const {
    createAgentSession,
  } = useMultiAgentCoordination();
  const { events, setLocalEvents, users, selectedDate } = useCalendar();
  const { startPreview, isPreviewMode } = useAgentPreview();

  // Stop pulsing after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  // Create a demo event
  const createDemoEvent = useCallback((
    title: string,
    dayOffset: number,
    hour: number,
    minute: number,
    durationMinutes: number,
    color: string,
    description: string = "AI-scheduled meeting"
  ): IEvent => {
    const startDate = setMinutes(
      setHours(addDays(selectedDate, dayOffset), hour),
      minute
    );
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    return {
      id: Date.now() + Math.random() * 1000,
      title,
      description,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      color: color as IEvent["color"],
      user: users[0] || { id: "1", name: "User", picturePath: null },
    };
  }, [selectedDate, users]);

  // Add to action log with animation delay
  const logAction = useCallback((message: string) => {
    setActionLog(prev => [...prev, message]);
  }, []);

  // Demo: AI schedules meetings, modifies conflicts, and removes events
  const runSandboxDemo = useCallback(async () => {
    setIsRunning(true);
    setCurrentStep(1);
    setShowPulse(false);
    setActionLog([]);

    try {
      // Step 1: AI starts analyzing
      await createAgentSession("scheduler-demo", "claude");
      logAction("🤖 Connected to AI scheduler");
      logAction("📅 Scanning your calendar...");
      await new Promise((r) => setTimeout(r, 1500));

      // Get existing events to modify/delete
      const existingEvents = [...events];
      const eventToModify = existingEvents[0]; // First event to reschedule
      const eventToDelete = existingEvents.length > 1 ? existingEvents[1] : null; // Second event to remove

      // Step 2: Add new meeting
      setCurrentStep(2);
      const newEvent = createDemoEvent("Team Standup", 0, 9, 0, 30, "blue", "Daily sync with the team");
      logAction(`➕ Adding: Team Standup (Today 9:00 AM)`);
      await new Promise((r) => setTimeout(r, 800));

      // Step 3: Modify existing event (reschedule)
      setCurrentStep(3);
      let modifiedEvent: typeof eventToModify | null = null;
      if (eventToModify) {
        // Shift the event by 2 hours
        const originalStart = new Date(eventToModify.startDate);
        const originalEnd = new Date(eventToModify.endDate);
        const newStart = new Date(originalStart.getTime() + 2 * 60 * 60 * 1000);
        const newEnd = new Date(originalEnd.getTime() + 2 * 60 * 60 * 1000);
        modifiedEvent = {
          ...eventToModify,
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        };
        logAction(`✏️ Rescheduling: "${eventToModify.title}" (+2 hours)`);
      } else {
        logAction(`✏️ No events to reschedule`);
      }
      await new Promise((r) => setTimeout(r, 800));

      // Step 4: Remove an event
      setCurrentStep(4);
      if (eventToDelete) {
        logAction(`🗑️ Removing: "${eventToDelete.title}"`);
      } else {
        logAction(`🗑️ No events to remove`);
      }
      await new Promise((r) => setTimeout(r, 800));

      // Apply all changes in a single update to avoid stale state
      setLocalEvents((prev) => {
        let result = [...prev];

        // Add new event
        result.push(newEvent);

        // Modify event (replace old with new)
        if (modifiedEvent && eventToModify) {
          result = result.map(e => e.id === eventToModify.id ? modifiedEvent! : e);
        }

        // Remove event
        if (eventToDelete) {
          result = result.filter(e => e.id !== eventToDelete.id);
        }

        return result;
      });

      // Step 5: Show preview for user approval
      setCurrentStep(5);
      logAction("✅ All changes ready for review");

      // Start preview mode (shows phantom events on calendar)
      if (!isPreviewMode) {
        await startPreview("scheduler-demo");
      }

      // Keep panel open to show success
      await new Promise((r) => setTimeout(r, 500));

    } catch (error) {
      console.error("Demo failed:", error);
      logAction("❌ Demo encountered an error");
    } finally {
      setIsRunning(false);
    }
  }, [createAgentSession, createDemoEvent, events, isPreviewMode, logAction, setLocalEvents, startPreview]);

  // Expose method to parent
  useImperativeHandle(ref, () => ({
    openAndRunDemo: () => {
      setIsOpen(true);
      // Small delay to let the panel animate in
      setTimeout(() => {
        runSandboxDemo();
      }, 300);
    },
  }), [runSandboxDemo]);

  // Reset demo state
  const resetDemo = () => {
    localStorage.removeItem("legit-agent-sessions");
    localStorage.removeItem("legit-commit-history");
    localStorage.removeItem("webmcp-welcome-seen");
    window.location.reload();
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        {/* Pulsing ring animation */}
        {showPulse && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
            <span className="absolute inset-0 animate-pulse rounded-full bg-primary opacity-50" />
          </>
        )}
        <Button
          size="lg"
          onClick={() => setIsOpen(true)}
          className={cn(
            "relative gap-2 rounded-full px-6 py-6 text-base font-semibold shadow-xl",
            "transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          )}
        >
          <Sparkles className="size-5" />
          Try AI Demo
          <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="bg-primary px-5 py-4 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/20">
              <Bot className="size-5" />
            </div>
            <div>
              <h3 className="font-bold">AI Calendar Assistant</h3>
              <p className="text-xs text-primary-foreground/80">
                Watch AI manage your schedule
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="size-8 rounded-full p-0 text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="p-5">
        {/* Main demo card - show when not running */}
        {!isRunning && !currentStep && (
          <div className="mb-4 rounded-lg border border-border bg-secondary p-4">
            <div className="mb-4 text-center">
              <h4 className="font-semibold text-foreground">
                See AI in Action
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Watch AI propose meetings, then approve or reject
              </p>
            </div>

            {/* What the demo will show */}
            <div className="mb-4 space-y-1.5 text-xs text-muted-foreground">
              <p className="flex items-center gap-2"><span className="text-green-500">+</span> Add a new meeting</p>
              <p className="flex items-center gap-2"><span className="text-amber-500">~</span> Reschedule an existing event</p>
              <p className="flex items-center gap-2"><span className="text-red-500">−</span> Remove a cancelled meeting</p>
            </div>

            <Button
              size="lg"
              onClick={runSandboxDemo}
              disabled={isRunning}
              className="w-full gap-2 py-5 text-base font-semibold"
            >
              <Play className="size-5" />
              Start Demo
            </Button>
          </div>
        )}

        {/* Progress steps - show when running */}
        {(isRunning || currentStep) && (
          <div className="mb-4 space-y-1 rounded-lg bg-muted p-4">
            {DEMO_STEPS.map((step, index) => (
              <EnhancedStep
                key={index}
                step={step}
                stepNum={index + 1}
                active={currentStep === index + 1}
                done={currentStep !== null && currentStep > index + 1}
                hidden={currentStep !== null && currentStep < index + 1}
              />
            ))}
          </div>
        )}

        {/* Live action log */}
        {actionLog.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-secondary/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-xs font-medium text-muted-foreground">Activity Log</span>
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {actionLog.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    "text-xs text-foreground transition-all duration-300",
                    index === actionLog.length - 1 && "font-medium"
                  )}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Value prop reminder - show when not running */}
        {!isRunning && !currentStep && (
          <div className="mb-4 rounded-lg bg-accent p-3">
            <p className="text-center text-xs font-medium text-accent-foreground">
              No changes are made until you approve them
            </p>
          </div>
        )}

        {/* Reset link */}
        <button
          onClick={resetDemo}
          className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Reset demo
        </button>
      </div>
    </div>
  );
});

function EnhancedStep({
  step,
  stepNum,
  active,
  done,
  hidden,
}: {
  step: StepConfig;
  stepNum: number;
  active: boolean;
  done: boolean;
  hidden: boolean;
}) {
  const Icon = step.icon;

  if (hidden) {
    return (
      <div className="flex items-center gap-3 py-1.5 opacity-30 transition-all duration-300">
        <div className="flex size-7 items-center justify-center rounded-full bg-secondary">
          <span className="text-xs text-secondary-foreground">{stepNum}</span>
        </div>
        <span className="text-sm text-muted-foreground">{step.title}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2 transition-all duration-300",
        active && "text-foreground",
        done && "text-foreground opacity-60"
      )}
    >
      {done ? (
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/20">
          <CheckCircle2 className="size-4 text-primary" />
        </div>
      ) : (
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-all",
            active ? "bg-primary/20" : "bg-secondary"
          )}
        >
          <Icon className={cn("size-4", active ? step.iconColor : "text-muted-foreground")} />
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm", active && "font-semibold")}>{step.title}</span>
          {active && (
            <div className="size-2 animate-pulse rounded-full bg-primary" />
          )}
        </div>
        {active && (
          <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
        )}
      </div>
    </div>
  );
}
