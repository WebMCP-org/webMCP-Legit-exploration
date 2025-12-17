"use client";

import { useState } from "react";
import {
  X,
  Check,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  Bot,
} from "lucide-react";
import { useAgentPreview } from "@/calendar/contexts/agent-preview-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/calendar/interfaces";
import { format } from "date-fns";

/**
 * Review Changes Panel
 * A clean, PR-style interface to review AI-proposed calendar changes
 * Shows added, modified, and removed events in a user-friendly way
 */
export function ReviewChangesPanel() {
  const {
    isReviewPanelOpen,
    pendingChanges,
    loading,
    closeReviewPanel,
    acceptAllChanges,
    rejectAllChanges,
  } = useAgentPreview();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["added", "modified", "removed"])
  );

  // Don't render if the review panel is not open
  if (!isReviewPanelOpen) {
    return null;
  }

  const { added, modified, removed } = pendingChanges;
  const hasChanges = added.length > 0 || modified.length > 0 || removed.length > 0;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="fixed right-6 top-24 z-40 w-96 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-foreground" />
          <div>
            <h3 className="font-semibold text-foreground">Review Changes</h3>
            <p className="text-xs text-muted-foreground">
              {hasChanges
                ? `${added.length + modified.length + removed.length} proposed changes`
                : "No changes to review"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={closeReviewPanel}
          className="size-8 p-0"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Changes list */}
      <ScrollArea className="max-h-[60vh]">
        <div className="divide-y divide-border">
          {/* Added events */}
          {added.length > 0 && (
            <ChangeSection
              title="New Events"
              icon={Plus}
              iconClass="text-green-600 dark:text-green-400"
              bgClass="bg-green-50 dark:bg-green-950/30"
              count={added.length}
              expanded={expandedSections.has("added")}
              onToggle={() => toggleSection("added")}
            >
              {added.map((event) => (
                <EventCard key={event.id} event={event} type="added" />
              ))}
            </ChangeSection>
          )}

          {/* Modified events */}
          {modified.length > 0 && (
            <ChangeSection
              title="Updated Events"
              icon={Pencil}
              iconClass="text-amber-600 dark:text-amber-400"
              bgClass="bg-amber-50 dark:bg-amber-950/30"
              count={modified.length}
              expanded={expandedSections.has("modified")}
              onToggle={() => toggleSection("modified")}
            >
              {modified.map((mod) => (
                <ModifiedEventCard key={mod.after.id} before={mod.before} after={mod.after} />
              ))}
            </ChangeSection>
          )}

          {/* Removed events */}
          {removed.length > 0 && (
            <ChangeSection
              title="Removed Events"
              icon={Trash2}
              iconClass="text-red-600 dark:text-red-400"
              bgClass="bg-red-50 dark:bg-red-950/30"
              count={removed.length}
              expanded={expandedSections.has("removed")}
              onToggle={() => toggleSection("removed")}
            >
              {removed.map((event) => (
                <EventCard key={event.id} event={event} type="removed" />
              ))}
            </ChangeSection>
          )}

          {/* No changes */}
          {!hasChanges && (
            <div className="py-12 text-center">
              <Check className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No changes to review
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      {hasChanges && (
        <div className="flex gap-2 border-t border-border bg-muted/50 p-4">
          <Button
            variant="outline"
            onClick={rejectAllChanges}
            disabled={loading}
            className="flex-1 gap-2"
          >
            <X className="size-4" />
            Discard All
          </Button>
          <Button
            onClick={acceptAllChanges}
            disabled={loading}
            className="flex-1 gap-2"
          >
            <Check className="size-4" />
            Apply All
          </Button>
        </div>
      )}
    </div>
  );
}

function ChangeSection({
  title,
  icon: Icon,
  iconClass,
  bgClass,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  bgClass: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn("flex w-full items-center justify-between px-4 py-3", bgClass)}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", iconClass)} />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {count}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>
      {expanded && <div className="divide-y divide-border">{children}</div>}
    </div>
  );
}

const colorClasses: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  cyan: "bg-cyan-500",
  gray: "bg-gray-500",
};

function EventCard({
  event,
  type,
}: {
  event: IEvent;
  type: "added" | "removed";
}) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  return (
    <div
      className={cn(
        "px-4 py-3",
        type === "removed" && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Color indicator */}
        <div
          className={cn(
            "mt-1 size-3 shrink-0 rounded-full",
            colorClasses[event.color] || "bg-primary"
          )}
        />

        <div className="min-w-0 flex-1">
          {/* Title */}
          <h4
            className={cn(
              "font-medium text-foreground",
              type === "removed" && "line-through"
            )}
          >
            {event.title}
          </h4>

          {/* Date and time */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {format(startDate, "EEE, MMM d")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
            </span>
          </div>

          {/* Description */}
          {event.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModifiedEventCard({
  before,
  after,
}: {
  before: IEvent;
  after: IEvent;
}) {
  const beforeStart = new Date(before.startDate);
  const beforeEnd = new Date(before.endDate);
  const afterStart = new Date(after.startDate);
  const afterEnd = new Date(after.endDate);

  // Check what changed
  const titleChanged = before.title !== after.title;
  const timeChanged = before.startDate !== after.startDate || before.endDate !== after.endDate;
  const colorChanged = before.color !== after.color;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Color indicator - show both if changed */}
        <div className="mt-1 flex flex-col gap-1">
          {colorChanged ? (
            <>
              <div
                className={cn(
                  "size-3 rounded-full opacity-50",
                  colorClasses[before.color] || "bg-primary"
                )}
              />
              <div
                className={cn(
                  "size-3 rounded-full",
                  colorClasses[after.color] || "bg-primary"
                )}
              />
            </>
          ) : (
            <div
              className={cn(
                "size-3 rounded-full",
                colorClasses[after.color] || "bg-primary"
              )}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Title - show diff if changed */}
          {titleChanged ? (
            <div className="space-y-0.5">
              <h4 className="font-medium text-muted-foreground line-through">
                {before.title}
              </h4>
              <h4 className="font-medium text-foreground">
                {after.title}
              </h4>
            </div>
          ) : (
            <h4 className="font-medium text-foreground">
              {after.title}
            </h4>
          )}

          {/* Date and time - show diff if changed */}
          {timeChanged ? (
            <div className="mt-1 space-y-1">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground line-through">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {format(beforeStart, "EEE, MMM d")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {format(beforeStart, "h:mm a")} - {format(beforeEnd, "h:mm a")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {format(afterStart, "EEE, MMM d")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {format(afterStart, "h:mm a")} - {format(afterEnd, "h:mm a")}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {format(afterStart, "EEE, MMM d")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {format(afterStart, "h:mm a")} - {format(afterEnd, "h:mm a")}
              </span>
            </div>
          )}

          {/* Description */}
          {after.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {after.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
