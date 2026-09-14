import React, { PropsWithChildren } from "react";
import { Text as RNText, type TextProps } from "react-native";

import { cn } from "@/lib/cn";

type AppTextVariant =
    | "display"
    | "title"
    | "body"
    | "caption"
    | "button";

type AppTextProps = PropsWithChildren<
    TextProps & {
        variant?: AppTextVariant;
        className?: string;
    }
>;

const variants: Record<AppTextVariant, string> = {
    display:
        "text-[34px] leading-[40px] font-semibold text-primary",

    title:
        "text-[22px] leading-[28px] font-semibold text-primary",

    body:
        "text-[16px] leading-[24px] text-secondary",

    caption:
        "text-[12px] leading-[16px] text-muted",

    button:
        "text-[15px] leading-[20px] font-semibold text-primary",
};

export default function AppText({
    children,
    variant = "body",
    className,
    ...props
}: AppTextProps) {
    return (
        <RNText
            {...props}
            className={cn(
                "font-satoshi",
                variants[variant],
                className,
            )}
        >
            {children}
        </RNText>
    );
}