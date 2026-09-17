export type DataEvent = "conversations" | "conversationArchived" | "messages" | "reflections" | "checkIns" | "signals" | "memories" | "patterns" | "experiments" | "learnings" | "insights";

const listeners = new Map<DataEvent, Set<() => void>>();

export const dataEvents = {
    emit(event: DataEvent) {
        listeners.get(event)?.forEach((listener) => listener());
    },
    subscribe(event: DataEvent, listener: () => void) {
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(listener);
        listeners.set(event, eventListeners);
        return () => {
            eventListeners.delete(listener);
        };
    },
};
