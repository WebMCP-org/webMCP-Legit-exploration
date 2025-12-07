import type { TEventColor } from "@/calendar/types";

export interface IUser {
  id: string;
  name: string;
  picturePath: string | null;
}

/**
 * Phantom status for events from agent branches that are pending approval
 */
export type TPhantomStatus = "added" | "modified" | "removed";

export interface IEvent {
  id: number;
  startDate: string;
  endDate: string;
  title: string;
  color: TEventColor;
  description: string;
  user: IUser;
  /** If set, this event is a phantom (pending approval from agent branch) */
  _phantom?: TPhantomStatus;
  /** The agent that proposed this change */
  _agentId?: string;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
