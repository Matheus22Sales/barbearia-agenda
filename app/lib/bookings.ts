export type Booking = {
  id: string;
  serviceId: string;
  serviceName: string;
  proId: string;
  proName: string;
  date: string;
  time: string;
  status?: string | null;
};

const STORAGE_KEY = "tracked-booking-ids";

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readTrackedBookingIds(): string[] {
  if (typeof window === "undefined") return [];

  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((value): value is string => typeof value === "string");
}

export function writeTrackedBookingIds(ids: string[]) {
  if (typeof window === "undefined") return;

  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueIds));
}

export function trackBookingId(id: string) {
  if (!id) return;

  const current = readTrackedBookingIds();
  writeTrackedBookingIds([...current, id]);
}

export function untrackBookingId(id: string) {
  if (!id) return;

  const next = readTrackedBookingIds().filter((currentId) => currentId !== id);
  writeTrackedBookingIds(next);
}

export function clearTrackedBookingIds() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

