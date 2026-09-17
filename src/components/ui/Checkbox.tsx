import { Pressable, type PressableProps } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { CheckIcon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/cn";

type CheckboxProps = Omit<PressableProps, "onPress"> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    size?: "sm" | "md";
    className?: string;
};

const sizes = {
    sm: {
        container: "size-5",
        icon: 13,
    },
    md: {
        container: "size-6",
        icon: 15,
    },
} as const;

export default function Checkbox({
    checked,
    onCheckedChange,
    size = "md",
    className,
    disabled = false,
    accessibilityLabel,
    ...props
}: CheckboxProps) {
    const dimensions = sizes[size];

    return (
        <Pressable
            {...props}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: Boolean(disabled) }}
            accessibilityLabel={accessibilityLabel}
            hitSlop={8}
            onPress={() => onCheckedChange(!checked)}
            className={cn(
                "items-center justify-center rounded-md border",
                dimensions.container,
                checked
                    ? "border-primary bg-primary"
                    : "border-border-strong bg-surface",
                disabled && "opacity-50",
                className,
            )}
        >
            {checked ? (
                <HugeiconsIcon
                    icon={CheckIcon}
                    size={dimensions.icon}
                    color="#FFFFFF"
                />
            ) : null}
        </Pressable>
    );
}
