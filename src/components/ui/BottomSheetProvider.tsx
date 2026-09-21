import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react-native";

import BottomSheet from "./BottomSheet";
import { copy } from "@/constants/copy";

type PendingAction = { label: string; description?: string; icon?: IconSvgElement; destructive?: boolean; disabled?: boolean; value: string };

type PendingSheet = {
    id: number;
    title: string;
    message?: string;
    header?: ReactNode;
    actions: PendingAction[];
    resolve: (value: string | null) => void;
};

type BottomSheetContextValue = {
    /** Show any sheet; resolves with the chosen action value, or null when dismissed. */
    show: (config: { title: string; message?: string; header?: ReactNode; actions: PendingAction[] }) => Promise<string | null>;
    /** Error/info notice with a single dismiss button. */
    notice: (title: string, message?: string, dismissLabel?: string) => void;
    /** Cancel/confirm dialog. Resolves true only when the confirm action is chosen. */
    confirm: (config: { title: string; message?: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean }) => Promise<boolean>;
    /** Multi-option menu. Resolves with the option index, or null when dismissed. */
    choose: (config: { title: string; message?: string; header?: ReactNode; options: Array<{ label: string; description?: string; icon?: IconSvgElement; destructive?: boolean }>; cancelLabel?: string }) => Promise<number | null>;
};

const BottomSheetContext = createContext<BottomSheetContextValue | null>(null);

export function BottomSheetProvider({ children }: { children: ReactNode }) {
    const [current, setCurrent] = useState<PendingSheet | null>(null);
    const [visible, setVisible] = useState(false);
    const idRef = useRef(0);
    const pendingRef = useRef<PendingSheet | null>(null);

    const dismiss = useCallback((value: string | null) => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        setVisible(false);
        // Resolve after the exit choreography so chained sheets (confirm →
        // error notice) never overlap.
        setTimeout(() => {
            setCurrent((active) => (active && active.id === pending?.id ? null : active));
            pending?.resolve(value);
        }, 120);
    }, []);

    const show = useCallback((config: { title: string; message?: string; header?: ReactNode; actions: PendingAction[] }) => {
        return new Promise<string | null>((resolve) => {
            // A replacing sheet settles the previous one as dismissed so no
            // caller ever waits forever.
            pendingRef.current?.resolve(null);
            const id = ++idRef.current;
            const pending: PendingSheet = { id, title: config.title, message: config.message, header: config.header, actions: config.actions, resolve };
            pendingRef.current = pending;
            setCurrent(pending);
            setVisible(true);
        });
    }, []);

    const notice = useCallback((title: string, message?: string, dismissLabel: string = copy.bottomSheet.defaultConfirm) => {
        void show({ title, message, actions: [{ label: dismissLabel, value: "dismiss" }] });
    }, [show]);

    const confirm = useCallback(async (config: { title: string; message?: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean }) => {
        const value = await show({
            title: config.title,
            message: config.message,
            actions: [
                { label: config.cancelLabel ?? copy.bottomSheet.cancel, value: "cancel" },
                { label: config.confirmLabel, value: "confirm", destructive: config.destructive ?? true },
            ],
        });
        return value === "confirm";
    }, [show]);

    const choose = useCallback(async (config: { title: string; message?: string; header?: ReactNode; options: Array<{ label: string; description?: string; icon?: IconSvgElement; destructive?: boolean }>; cancelLabel?: string }) => {
        const value = await show({
            title: config.title,
            message: config.message,
            header: config.header,
            actions: [
                ...config.options.map((option, index) => ({ label: option.label, description: option.description, icon: option.icon, destructive: option.destructive, value: `option:${index}` })),
                { label: config.cancelLabel ?? copy.bottomSheet.cancel, value: "cancel" },
            ],
        });
        if (!value?.startsWith("option:")) return null;
        return Number(value.slice("option:".length));
    }, [show]);

    const value = useMemo(() => ({ show, notice, confirm, choose }), [show, notice, confirm, choose]);

    return (
        <BottomSheetContext.Provider value={value}>
            {children}
            <BottomSheet
                visible={visible && current !== null}
                title={current?.title ?? ""}
                message={current?.message}
                header={current?.header}
                actions={(current?.actions ?? []).map((action) => ({
                    label: action.label,
                    description: action.description,
                    icon: action.icon,
                    destructive: action.destructive,
                    disabled: action.disabled,
                    onPress: () => dismiss(action.value),
                }))}
                onClose={() => dismiss(null)}
            />
        </BottomSheetContext.Provider>
    );
}

export function useBottomSheet(): BottomSheetContextValue {
    const context = useContext(BottomSheetContext);
    if (!context) throw new Error("useBottomSheet must be used inside BottomSheetProvider.");
    return context;
}
