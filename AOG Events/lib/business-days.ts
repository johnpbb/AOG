// Business-day arithmetic for registration expiry. Weekends (Sat/Sun) are
// skipped, judged in Fiji time (UTC+12, no DST). Public holidays are not.
const DAY_MS = 24 * 60 * 60 * 1000;
const FIJI_OFFSET_MS = 12 * 60 * 60 * 1000;

function isWeekendInFiji(ms: number) {
  const dow = new Date(ms + FIJI_OFFSET_MS).getUTCDay();
  return dow === 0 || dow === 6;
}

export function addBusinessDays(from: Date | string | number, days: number): Date {
  let ms = new Date(from).getTime();
  let remaining = days;
  while (remaining > 0) {
    ms += DAY_MS;
    if (!isWeekendInFiji(ms)) remaining--;
  }
  return new Date(ms);
}
