export interface UserRow {
  user_id: number;
  username: string | null;
  email?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expiry?: string | Date | null;
}

export interface CalendarRow {
  calendar_id: number;
  user_id: number;
  google_calendar_id: string;
  calendar_name?: string | null;
}

export interface CalendarEventRecord {
  calendar_id: number;
  gcal_event_id: string;
  event_name: string;
  event_start: string | Date;
  event_end: string | Date;
  priority?: number | null;
}

export interface PetitionRow {
  petition_id: number;
  group_id: number;
  created_by_user_id: number;
  title_raw: string;
  start_ms: number;
  end_ms: number;
  blocking_level: "B1" | "B2" | "B3";
}
