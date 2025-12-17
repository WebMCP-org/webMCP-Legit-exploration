"use client";

import { Check, X, Sparkles, Eye, FileText } from "lucide-react";
import { useAgentPreview } from "@/calendar/contexts/agent-preview-context";
import { usePendingChangesSummary } from "@/calendar/hooks/use-combined-events";
import { Button } from "@/components/ui/button";

/**
 * Banner shown at the top of the calendar when previewing agent changes.
 * Uses the design system colors for consistency.
 */
export function AgentPreviewBanner() {
  const {
    isPreviewMode,
    loading,
    stopPreview,
    openReviewPanel,
    acceptAllChanges,
    rejectAllChanges,
  } = useAgentPreview();

  const summary = usePendingChangesSummary();

  // Don't render if not in preview mode
  if (!isPreviewMode) {
    return null;
  }

  // Use summary if available, otherwise show default state
  const displaySummary = summary || {
    added: 0,
    modified: 0,
    removed: 0,
    total: 0,
    hasChanges: false,
    summary: "",
  };

  return (
    <div className="border-b border-border bg-primary text-primary-foreground">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* Left side: Preview status */}
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/20">
            <Eye className="size-5" />
          </div>

          {/* Text content */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">
                Preview Mode
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-medium">
                <Sparkles className="size-3" />
                AI Suggestions
              </span>
            </div>
            <p className="text-sm text-primary-foreground/80">
              Review the glowing events on your calendar before applying
            </p>
          </div>
        </div>

        {/* Center: Change summary - using phantom event colors for consistency */}
        <div className="flex items-center gap-3">
          {displaySummary.added > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-primary-foreground/20 px-3 py-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                +{displaySummary.added}
              </div>
              <span className="text-sm font-medium">
                new event{displaySummary.added !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {displaySummary.modified > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-primary-foreground/20 px-3 py-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                {displaySummary.modified}
              </div>
              <span className="text-sm font-medium">
                updated
              </span>
            </div>
          )}
          {displaySummary.removed > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-primary-foreground/20 px-3 py-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                -{displaySummary.removed}
              </div>
              <span className="text-sm font-medium">
                removed
              </span>
            </div>
          )}
          {!displaySummary.hasChanges && (
            <span className="text-sm text-primary-foreground/70">
              No changes to review
            </span>
          )}
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={stopPreview}
            className="text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground"
          >
            Cancel
          </Button>

          {displaySummary.hasChanges && (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={openReviewPanel}
                className="gap-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
              >
                <FileText className="size-4" />
                Review Details
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={rejectAllChanges}
                disabled={loading}
                className="gap-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
              >
                <X className="size-4" />
                Discard All
              </Button>

              <Button
                size="lg"
                onClick={acceptAllChanges}
                disabled={loading}
                variant="secondary"
                className="gap-2 font-semibold"
              >
                <Check className="size-4" />
                Apply Changes
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
