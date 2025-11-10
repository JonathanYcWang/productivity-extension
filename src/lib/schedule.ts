import { BlockWindow } from "../types";

/** Parse "HH:MM" into minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Return true if `now` falls within any active window for its local weekday. */
export function isWithinAnyWindow(now: Date, windows: BlockWindow[]): boolean {
  const day = now.getDay(); // 0-6
  const minutes = now.getHours() * 60 + now.getMinutes();
  return windows.some(w => {
    if (w.day !== day) return false;
    const start = toMinutes(w.start);
    const end = toMinutes(w.end);
    // handle both normal and overnight windows
    if (start <= end) {
      return minutes >= start && minutes < end;
    } else {
      return minutes >= start || minutes < end;
    }
  });
}

/** Find the next boundary time (start or end) after `now`. */
export function nextBoundaryAfter(now: Date, windows: BlockWindow[]): Date {
  const candidates: Date[] = [];

  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    const day = d.getDay();

    const todays = windows.filter(w => w.day === day);
    todays.forEach(w => {
      const start = toMinutes(w.start);
      const end = toMinutes(w.end);

      const mk = (mins: number) => {
        const dt = new Date(d);
        dt.setHours(0, 0, 0, 0);
        dt.setMinutes(mins);
        return dt;
      };

      candidates.push(mk(start));
      candidates.push(mk(end));
    });
  }

  const future = candidates
    .map(c => ({ c, t: c.getTime() }))
    .filter(x => x.t > now.getTime())
    .sort((a, b) => a.t - b.t);

  return future[0]?.c ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
