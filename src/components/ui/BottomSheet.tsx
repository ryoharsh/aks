import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    useReducedMotion,
} from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import { MOTION } from "@/lib/motion";
import { copy } from "@/constants/copy";

export type SheetAction = {
    label: string;
    description?: string;
    icon?: IconSvgElement;
    destructive?: boolean;
    disabled?: boolean;
    onPress: () => void;
};

type Props = {
    visible: boolean;
    title: string;
    message?: string;
    header?: ReactNode;
    body?: ReactNode;
    actions: SheetAction[];
    onClose: () => void;
};

export const SHEET_EXIT_MS = 240;

const panelEntering = SlideInDown.duration(MOTION.enterMs).easing(
    Easing.out(Easing.cubic),
);

const panelExiting = SlideOutDown.duration(SHEET_EXIT_MS - 40).easing(
    Easing.in(Easing.cubic),
);

export default function BottomSheet({
    visible,
    title,
    message,
    header,
    body,
    actions,
    onClose,
}: Props) {
    const [shown, setShown] = useState(visible);
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();

    const reduceMotion = useReducedMotion();

    const surfaceColor = useResolveClassNames("bg-surface").backgroundColor;
    const borderColor = useResolveClassNames("border-border").borderColor;
    const handleColor = useResolveClassNames("bg-border").backgroundColor;
    const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
    const textHighColor = useResolveClassNames("text-text-high").color;
    const textLowColor = useResolveClassNames("text-text-low").color;
    const iconColor = useResolveClassNames("text-text-medium").color;
    const destructiveColor = "#DC2626";

    const rich = actions.some((action) => action.icon);

    useEffect(() => {
        if (visible) {
            setShown(true);
            return;
        }

        const timeout = setTimeout(
            () => setShown(false),
            reduceMotion ? 60 : SHEET_EXIT_MS,
        );

        return () => clearTimeout(timeout);
    }, [visible, reduceMotion]);

    if (!shown) {
        return null;
    }

    return (
        <Modal
            visible={shown}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View
                // The modal window is measured twice on Android — first at the
                // window-inset size (display minus the status and navigation
                // bars), then at the full display size. A Reanimated *layout*
                // animation on the bottom-anchored panel bakes in the origin it
                // sees at mount, so that second measurement used to leave the
                // sheet permanently offset upward by the inset delta, silently
                // cutting the bottom safe-area padding off the sheet. Pinning
                // the root to the window height up front keeps the panel's
                // origin stable, so the slide settles exactly on the bottom.
                style={[styles.root, { height: windowHeight }]}
            >
                {visible ? (
                    <>
                        <Animated.View
                            entering={
                                reduceMotion
                                    ? FadeIn.duration(120)
                                    : FadeIn.duration(MOTION.enterFastMs)
                            }
                            exiting={FadeOut.duration(120)}
                            style={styles.backdrop}
                        >
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={copy.bottomSheet.dismissA11y}
                                onPress={onClose}
                                style={styles.backdropPressable}
                            />
                        </Animated.View>

                        <Animated.View
                            entering={
                                reduceMotion
                                    ? FadeIn.duration(MOTION.enterFastMs)
                                    : panelEntering
                            }
                            exiting={
                                reduceMotion
                                    ? FadeOut.duration(120)
                                    : panelExiting
                            }
                            style={[
                                styles.panel,
                                {
                                    backgroundColor: surfaceColor,
                                    borderColor,
                                    paddingBottom: insets.bottom + 16,
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.handle,
                                    { backgroundColor: handleColor },
                                ]}
                            />

                            {header ? (
                                <View style={styles.header}>{header}</View>
                            ) : null}

                            <AppText
                                variant="title"
                                style={[
                                    styles.title,
                                    { color: textHighColor },
                                ]}
                            >
                                {title}
                            </AppText>

                            {message ? (
                                <AppText
                                    style={[
                                        styles.message,
                                        { color: textLowColor },
                                    ]}
                                >
                                    {message}
                                </AppText>
                            ) : null}

                            {body ? <View style={styles.body}>{body}</View> : null}

                            {actions.length > 0 ? (
                                <View style={styles.actions}>
                                    {actions.map((action, index) => (
                                        <Pressable
                                            key={action.label}
                                            onPress={
                                                action.disabled
                                                    ? undefined
                                                    : action.onPress
                                            }
                                            accessibilityRole="button"
                                            accessibilityLabel={action.label}
                                            accessibilityState={{
                                                disabled: action.disabled,
                                            }}
                                            style={[
                                                styles.row,
                                                rich && styles.rowRich,
                                                index > 0 && [
                                                    styles.rowBorder,
                                                    { borderTopColor: borderColor },
                                                ],
                                                action.disabled &&
                                                styles.rowDisabled,
                                            ]}
                                        >
                                            {action.icon ? (
                                                <View
                                                    style={[
                                                        styles.iconTile,
                                                        { backgroundColor },
                                                    ]}
                                                >
                                                    <HugeiconsIcon
                                                        icon={action.icon}
                                                        size={19}
                                                        color={
                                                            action.destructive
                                                                ? destructiveColor
                                                                : iconColor
                                                        }
                                                    />
                                                </View>
                                            ) : null}

                                            <View
                                                style={rich && styles.labelWrapRich}
                                            >
                                                <AppText
                                                    variant="button"
                                                    style={[
                                                        {
                                                            color: action.destructive
                                                                ? destructiveColor
                                                                : textHighColor,
                                                        },
                                                        rich && styles.textLeft,
                                                    ]}
                                                >
                                                    {action.label}
                                                </AppText>

                                                {action.description ? (
                                                    <AppText
                                                        variant="caption"
                                                        style={[
                                                            styles.description,
                                                            styles.textLeft,
                                                            { color: textLowColor },
                                                        ]}
                                                    >
                                                        {action.description}
                                                    </AppText>
                                                ) : null}
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : null}
                        </Animated.View>
                    </>
                ) : null}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        // Deliberately no `flex: 1`: `flex` would set `flexBasis: 0` and grow to
        // whatever the modal container reports at first measure. The height is
        // pinned at the call site instead — see the note there.
        alignSelf: "stretch",
    },
    backdrop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    backdropPressable: {
        width: "100%",
        height: "100%",
    },
    panel: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    handle: {
        marginHorizontal: "auto",
        marginBottom: 16,
        height: 4,
        width: 40,
        borderRadius: 999,
    },
    header: {
        marginBottom: 16,
        alignItems: "center",
    },
    title: {
        textAlign: "center",
    },
    message: {
        marginTop: 8,
        textAlign: "center",
        lineHeight: 24,
    },
    body: {
        marginTop: 16,
    },
    actions: {
        marginTop: 16,
        overflow: "hidden",
        borderRadius: 16,
    },
    row: {
        alignItems: "center",
        paddingVertical: 16,
    },
    rowRich: {
        flexDirection: "row",
        paddingHorizontal: 8,
    },
    rowBorder: {
        borderTopWidth: 1,
    },
    rowDisabled: {
        opacity: 0.5,
    },
    iconTile: {
        height: 40,
        width: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
    },
    labelWrapRich: {
        marginLeft: 12,
        flex: 1,
    },
    textLeft: {
        textAlign: "left",
    },
    description: {
        marginTop: 2,
    },
});