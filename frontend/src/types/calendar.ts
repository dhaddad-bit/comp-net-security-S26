export type BlockingLevel = "B1" | "B2" | "B3";

export interface CalendarEvent {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  mode?: "normal" | "blocking" | "petition" | "availability";
  priority?: number | null;
  blockingLevel?: BlockingLevel;
  isAllDay?: boolean;
}

export interface AvailabilityBlock {
  startMs: number;
  endMs: number;
  availableCount: number;
}

export interface PetitionEvent {
  petition_id?: number;
  petitionId?: number;
  group_id?: number;
  groupId?: number;
  title: string;
  startMs: number;
  endMs: number;
  blocking_level?: BlockingLevel;
  blockingLevel?: BlockingLevel;
}
