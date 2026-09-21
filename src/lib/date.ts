export function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

/**
 * Honest, coarse "time ago" copy for sync/preview lines. Returns null when the
 * timestamp is missing or unparseable so callers never invent a sync time.
 */
export function formatRelativeTime(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 45) return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(value);
}

export function dateGroup(value: string): "Today" | "This week" | "Earlier" {
    const date = new Date(value);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (date >= startToday) return "Today";
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6);
    return date >= startWeek ? "This week" : "Earlier";
}
