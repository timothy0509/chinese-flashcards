export interface DayStat {
  reviews: number;
  correct: number;
}

export function dayKeyOf(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Consecutive active days ending today (or yesterday if today is quiet). */
export function streakOf(
  days: Record<string, DayStat>,
  today = new Date(),
): number {
  const cursor = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if ((days[dayKeyOf(cursor)]?.reviews ?? 0) === 0) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while ((days[dayKeyOf(cursor)]?.reviews ?? 0) > 0) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface DayBar {
  key: string;
  weekday: string;
  reviews: number;
  correct: number;
  isToday: boolean;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function last7Bars(
  days: Record<string, DayStat>,
  today = new Date(),
): DayBar[] {
  const out: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - i,
    );
    const key = dayKeyOf(d);
    const s = days[key];
    out.push({
      key,
      weekday: WEEKDAYS[d.getDay()] ?? "",
      reviews: s?.reviews ?? 0,
      correct: s?.correct ?? 0,
      isToday: i === 0,
    });
  }
  return out;
}
