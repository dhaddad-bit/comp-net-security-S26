import type { GoogleCalendarListEvent } from "../types/google-calendar";

export interface NormalizedGoogleEvent {
  title: string;
  start: string;
  end: string;
  event_id: string;
}

export function mapGoogleCalendarEvent(event: GoogleCalendarListEvent): NormalizedGoogleEvent {
  const start = event.start.dateTime ?? event.start.date ?? "";
  const end = event.end.dateTime ?? event.end.date ?? "";

  return {
    title: event.summary || "No Title",
    start,
    end,
    event_id: event.id
  };
}
