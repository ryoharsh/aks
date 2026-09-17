import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Uniwind } from "uniwind";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mode, setModeState] = useState<ThemeMode>("system");
    const setMode = useCallback((nextMode: ThemeMode) => {
        Uniwind.setTheme(nextMode);
        setModeState(nextMode);
    }, []);

    const value = useMemo(
        () => ({
            mode,
            setMode,
        }),
        [mode, setMode]
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error(
            "useTheme must be used inside ThemeProvider"
        );
    }

    return context;
}
