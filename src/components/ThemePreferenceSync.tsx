import { useEffect } from "react";

import { usePreferences } from "@/providers/PreferencesProvider";
import { useTheme } from "@/theme/ThemeProvider";

export default function ThemePreferenceSync() {
    const { preferences } = usePreferences();
    const { setMode } = useTheme();

    useEffect(() => {
        setMode(preferences.appearance);
    }, [preferences.appearance, setMode]);

    return null;
}
