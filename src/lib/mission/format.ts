import { format, isToday, isTomorrow } from "date-fns";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function formatWhen(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const time = format(d, "h:mm a");
  if (isToday(d)) return `Today ${time}`;
  if (isTomorrow(d)) return `Tomorrow ${time}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return format(d, sameYear ? "MMM d, h:mm a" : "MMM d, yyyy");
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function toLocalInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function quickDeadlines(now: number): { id: string; label: string; at: number }[] {
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(9, 0, 0, 0);
  const options = [{ id: "hour", label: "In 1 hour", at: now + HOUR }];
  if (tonight.getTime() > now + 30 * MINUTE) {
    options.push({ id: "tonight", label: "Tonight", at: tonight.getTime() });
  }
  options.push({ id: "morning", label: "Tomorrow 9:00", at: morning.getTime() });
  return options;
}
