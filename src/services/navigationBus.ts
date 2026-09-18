import type { TimelineNavigationTarget } from "@/types/timeline";

type Listener = (target: TimelineNavigationTarget) => void;
type MainPageListener = (pageIndex: number) => void;

const listeners = new Set<Listener>();
const mainPageListeners = new Set<MainPageListener>();

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
    subscribeMainPage(listener: MainPageListener) {
        mainPageListeners.add(listener);
        return () => {
            mainPageListeners.delete(listener);
        };
    },
    requestMainPage(pageIndex: number) {
        mainPageListeners.forEach((listener) => listener(pageIndex));
    },
};