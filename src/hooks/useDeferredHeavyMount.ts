import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

/**
 * Defers rendering heavy children until the current navigation transition
 * (and any pending interaction) has finished. Children that mount during the
 * transition compete with the transition animation for the UI thread and make
 * screen opens feel janky — this mounts them right after it settles instead.
 *
 * The screen renders instantly (light shell first), heavy animated layers
 * fade in once the transition completes. Nothing about the settled layout
 * changes — pixels are identical, they just arrive after the transition.
 */
export function useDeferredHeavyMount(delayMs = 320): boolean {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const interaction = InteractionManager.runAfterInteractions(() => {
            if (cancelled) return;
            // InteractionManager can resolve before the stack transition ends
            // on some navigators; the short timer guarantees a smooth settle.
            setTimeout(() => {
                if (!cancelled) setReady(true);
            }, delayMs);
        });
        return () => {
            cancelled = true;
            interaction.cancel();
        };
    }, [delayMs]);

    return ready;
}
