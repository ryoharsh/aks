/**
 * Time-of-day bucket for time-based greetings.
 *
 * Boundaries (local time, `Date.getHours()`):
 * - morning:   05:00–11:59
 * - afternoon: 12:00–16:59
 * - evening:   17:00–20:59
 * - night:     21:00–04:59
 */
export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function getDayPart(date: Date = new Date()): DayPart {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
}
