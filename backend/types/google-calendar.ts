export interface GoogleCalendarDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleCalendarListEvent {
  id: string;
  summary?: string | null;
  start: GoogleCalendarDateTime;
  end: GoogleCalendarDateTime;
}

export interface GoogleCalendarListResponse {
  items?: GoogleCalendarListEvent[];
}
