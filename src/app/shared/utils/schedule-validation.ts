/** Minimum lead before scheduled publish (matches backend). */
export const SCHEDULE_MIN_LEAD_MS = 15 * 60 * 1000;

export function isScheduleAtLeastMinLead(scheduled: Date, nowMs: number = Date.now()): boolean {
  return scheduled.getTime() >= nowMs + SCHEDULE_MIN_LEAD_MS;
}

/**
 * Validate local date + time strings from `<input type="date">` / `<input type="time">`.
 */
export function validateScheduleDateTimeStrings(
  dateStr: string,
  timeStr: string
): { ok: true; scheduled: Date } | { ok: false; message: string } {
  const d = (dateStr || '').trim();
  const t = (timeStr || '').trim();
  if (!d || !t) {
    return { ok: false, message: 'Date and time are required.' };
  }
  const scheduled = new Date(`${d}T${t}`);
  if (Number.isNaN(scheduled.getTime())) {
    return { ok: false, message: 'Invalid date or time.' };
  }
  if (!isScheduleAtLeastMinLead(scheduled)) {
    return {
      ok: false,
      message: 'Choose a time at least 15 minutes from now.'
    };
  }
  return { ok: true, scheduled };
}
