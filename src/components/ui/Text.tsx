import React, { PropsWithChildren } from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";

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

/**
 * Tracking breaks any writing system whose glyphs change shape when they join.
 * In Devanagari and the other South Asian abugidas it splits conjuncts
 * (क्ष renders as क ् ष); in the cursive Arabic-script languages, including
 * Urdu, it breaks the letter joining that the script depends on. The design's
 * `tracking-[…]` classes are calibrated for Latin, so tracking is neutralized
 * for these strings. The app's Satoshi typeface has no glyphs for them; the OS
 * falls back to its bundled font for the script.
 *
 * Sources: Arabic and Arabic Supplement/Extended/Presentation Forms (also used
 * by Urdu), Syriac, Thaana, N'Ko, Mongolian, and the Indic abugidas.
 */
const JOINING_SCRIPT =
    /[\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u1800-\u18AF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF]/;

const noTrackingStyle: TextStyle = { letterSpacing: 0 };

export default function AppText({
    children,
    variant = "body",
    className,
    style,
    ...props
}: AppTextProps) {
    // Only top-level strings are inspected; a nested <Text> child is checked by
    // its own AppText instance.
    const needsNoTracking = typeof children === "string" && JOINING_SCRIPT.test(children);
    return (
        <RNText
            {...props}
            // Listed before the caller's style so an explicit letterSpacing still wins.
            style={[needsNoTracking ? noTrackingStyle : null, style]}
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