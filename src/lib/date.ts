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

export function dateGroup(value: string): "Today" | "This week" | "Earlier" {
    const date = new Date(value);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (date >= startToday) return "Today";
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6);
    return date >= startWeek ? "This week" : "Earlier";
}
