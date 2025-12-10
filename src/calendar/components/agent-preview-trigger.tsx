"use client";

import { Eye, EyeOff } from "lucide-react";
import { useAgentPreview } from "@/calendar/contexts/agent-preview-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Floating button to show/hide agent preview panel.
 * Can be used as an alternative entry point to preview mode.
 */
interface AgentPreviewTriggerProps {
  agentId: string;
  hasChanges?: boolean;
  className?: string;
}

export function AgentPreviewTrigger({
  agentId,
  hasChanges = false,
  className,
}: AgentPreviewTriggerProps) {
  const { isPreviewMode, previewAgentId, startPreview, stopPreview } =
    useAgentPreview();

  const isThisAgentPreviewed = isPreviewMode && previewAgentId === agentId;

  const handleClick = () => {
    if (isThisAgentPreviewed) {
      stopPreview();
    } else {
      startPreview(agentId);
    }
  };

  return (
    <Button
      variant={isThisAgentPreviewed ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      className={cn(
        isThisAgentPreviewed && "bg-purple-600 hover:bg-purple-700",
        hasChanges &&
          !isThisAgentPreviewed &&
          "border-purple-300 text-purple-700",
        className
      )}
    >
      {isThisAgentPreviewed ? (
        <>
          <EyeOff className="mr-1.5 size-4" />
          Exit Preview
        </>
      ) : (
        <>
          <Eye className="mr-1.5 size-4" />
          Preview Changes
          {hasChanges && (
            <span className="ml-1.5 flex size-2 rounded-full bg-purple-500" />
          )}
        </>
      )}
    </Button>
  );
}
