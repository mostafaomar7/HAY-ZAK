/** Backend-friendly date string: yyyy-MM-dd, no timezone drift. */
export function toIsoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function isPast(value: string | Date): boolean {
  return new Date(value).getTime() < Date.now();
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / 86_400_000);
}
