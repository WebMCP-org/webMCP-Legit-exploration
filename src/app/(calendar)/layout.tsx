/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";

import { Settings, GitBranch, History, Users } from "lucide-react";

import { LegitCalendarProvider } from "@/legit-webmcp";
import { CalendarMCPTools } from "@/calendar/mcp-tools/CalendarMCPTools";
import { AgentPreviewProvider } from "@/calendar/contexts/agent-preview-context";
import { AgentPreviewBanner } from "@/calendar/components/agent-preview-banner";

import { ChangeBadgeVariantInput } from "@/calendar/components/change-badge-variant-input";
import { ChangeVisibleHoursInput } from "@/calendar/components/change-visible-hours-input";
import { ChangeWorkingHoursInput } from "@/calendar/components/change-working-hours-input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLegitContext, useLegitFile } from "@legit-sdk/react";
import { useEffect, useState } from "react";
import { getEvents, getUsers } from "@/calendar/requests";
import type { IEvent, IUser } from "@/calendar/interfaces";

export default function Layout({ children }: { children: React.ReactNode }) {
  // Use Legit files for persistent state with version history
  const {
    data: eventsData,
    setData: setEventsData,
    history,
  } = useLegitFile("/calendar/events.json", { initialData: "[]" });
  const { data: usersData, setData: setUsersData } = useLegitFile(
    "/calendar/users.json",
    { initialData: "[]" }
  );
  const { rollback, legitFs, head } = useLegitContext();
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string>("main");

  // Parse data
  const events: IEvent[] = eventsData ? JSON.parse(eventsData) : [];
  const users: IUser[] = usersData ? JSON.parse(usersData) : [];

  // Seed initial data
  const seedData = async () => {
    const initialEvents = await getEvents();
    const initialUsers = await getUsers();
    await setEventsData(JSON.stringify(initialEvents, null, 2));
    await setUsersData(JSON.stringify(initialUsers, null, 2));
    setIsInitialized(true);
  };

  useEffect(() => {
    if (!eventsData || !usersData) return;
    if (!isInitialized && events.length === 0) {
      seedData();
    } else {
      setIsInitialized(true);
    }
  }, [eventsData, usersData, isInitialized, events.length]);

  // Update current branch display
  useEffect(() => {
    if (legitFs) {
      legitFs.getCurrentBranch().then(setCurrentBranch);
    }
  }, [legitFs, head]);

  // Expose debug functions to window
  useEffect(() => {
    // @ts-ignore
    window.rollbackLastCommit = () => {
      if (history && history.length > 1) {
        rollback(history[1].oid);
      }
    };
    // @ts-ignore
    window.showHistory = () => {
      console.log("Calendar History:", history);
    };
  }, [history, rollback]);

  const isLoading = !isInitialized || users.length === 0;

  return (
    <>
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-lg">Loading Calendar...</div>
            <div className="text-sm text-gray-500">
              Initializing versioned state
            </div>
          </div>
        </div>
      ) : (
        <LegitCalendarProvider initialEvents={events} initialUsers={users}>
          <AgentPreviewProvider>
            {/* Register MCP tools - must be inside LegitCalendarProvider */}
            <CalendarMCPTools />

            {/* Agent preview banner - shows when previewing agent changes */}
            <AgentPreviewBanner />

            <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-8 py-4">
              {/* Branch indicator */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <GitBranch className="size-3" />
                <span>Branch: {currentBranch}</span>
                {history && history.length > 0 && (
                  <>
                    <span className="mx-2">|</span>
                    <History className="size-3" />
                    <span>{history.length} commits</span>
                  </>
                )}
              </div>

              {children}

              <Accordion type="single" collapsible>
                <AccordionItem value="item-1" className="border-none">
                  <AccordionTrigger className="flex-none gap-2 py-0 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Settings className="size-4" />
                      <p className="text-base font-semibold">Calendar settings</p>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="mt-4 flex flex-col gap-6">
                      <ChangeBadgeVariantInput />
                      <ChangeVisibleHoursInput />
                      <ChangeWorkingHoursInput />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </AgentPreviewProvider>
        </LegitCalendarProvider>
      )}
    </>
  );
}
