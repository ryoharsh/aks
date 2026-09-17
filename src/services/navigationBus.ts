import type { TimelineNavigationTarget } from "@/types/timeline";

type Listener = (target: TimelineNavigationTarget) => void;

const listeners = new Set<Listener>();

export const navigationBus = {
    subscribe(listener: Listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
    requestTimelineNavigation(target: TimelineNavigationTarget) {
        listeners.forEach((listener) => listener(target));
    },
};