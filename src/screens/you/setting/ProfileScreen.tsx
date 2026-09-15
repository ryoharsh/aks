import { useMemo, useRef, useState } from "react";
import {
    Animated as NativeAnimated,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, {
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Camera01Icon,
    Clock01Icon,
    Edit02Icon,
    Globe02Icon,
    GoogleIcon,
    Mail01Icon,
    SparklesIcon,
    Target01Icon,
    UserIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Profile">;
type SignInMethod = "email" | "google";
type ProfileRowProps = {
    icon: IconSvgElement;
    title: string;
    value: string;
    onPress?: () => void;
    last?: boolean;
};

export default function ProfileScreen({ navigation }: Props) {
    const [signInMethod] = useState<SignInMethod>("google");
    const [name, setName] = useState("Harsh");
    const [email, setEmail] = useState("harsh@example.com");
    const [draftName, setDraftName] = useState(name);
    const [draftEmail, setDraftEmail] = useState(email);
    const [editing, setEditing] = useState(false);
    const sheetTranslateY = useRef(new NativeAnimated.Value(0)).current;
    const iconColor = useResolveClassNames("text-text-medium").color;
    const canEditEmail = signInMethod === "email";

    const saveProfile = () => {
        const nextName = draftName.trim();
        const nextEmail = draftEmail.trim();
        if (!nextName || (canEditEmail && !nextEmail)) return;
        setName(nextName);
        if (canEditEmail) setEmail(nextEmail);
        setEditing(false);
    };

    const finishClosingEditor = () => {
        setDraftName(name);
        setDraftEmail(email);
        sheetTranslateY.setValue(0);
        setEditing(false);
    };

    const closeEditor = () => {
        NativeAnimated.timing(sheetTranslateY, {
            toValue: 500,
            duration: 220,
            useNativeDriver: true,
        }).start(finishClosingEditor);
    };

    const openEditor = () => {
        sheetTranslateY.setValue(0);
        setEditing(true);
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gesture) =>
                    gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
                onPanResponderMove: (_, gesture) => {
                    sheetTranslateY.setValue(Math.max(0, gesture.dy));
                },
                onPanResponderRelease: (_, gesture) => {
                    if (gesture.dy > 110 || gesture.vy > 1.1) {
                        closeEditor();
                        return;
                    }

                    NativeAnimated.spring(sheetTranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 70,
                        friction: 12,
                    }).start();
                },
                onPanResponderTerminate: () => {
                    NativeAnimated.spring(sheetTranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                },
            }),
        [email, name, sheetTranslateY],
    );

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">Profile</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5 items-center">
                    <View className="relative">
                        <View className="size-24 items-center justify-center rounded-full bg-primary">
                            <HugeiconsIcon icon={UserIcon} size={40} color="#FFFFFF" />
                        </View>
                        <Pressable onPress={openEditor} className="absolute -bottom-1 -right-1 size-9 items-center justify-center rounded-full border-2 border-background bg-surface">
                            <HugeiconsIcon icon={Camera01Icon} size={18} color={iconColor} />
                        </Pressable>
                    </View>
                    <AppText variant="title" className="mt-4 text-text-high">{name}</AppText>
                    <Pressable onPress={openEditor} className="mt-2 flex-row items-center rounded-full bg-surface px-4 py-2">
                        <HugeiconsIcon icon={Edit02Icon} size={16} color={iconColor} />
                        <AppText variant="caption" className="ml-2 text-text-medium">Edit profile</AppText>
                    </Pressable>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <SectionLabel>PERSONAL</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={Target01Icon} title="What you're exploring" value="Focus · Energy · Sleep" onPress={() => navigation.navigate("Exploring")} iconColor={iconColor} />
                        <ProfileRow icon={SparklesIcon} title="What Aks should notice" value="Your selected areas" onPress={() => navigation.navigate("NoticeAreas")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <SectionLabel>PREFERENCES</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={Clock01Icon} title="Timezone" value="IST" onPress={() => navigation.navigate("Timezone")} iconColor={iconColor} />
                        <ProfileRow icon={Globe02Icon} title="Language" value="English" onPress={() => navigation.navigate("Language")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(290)} className="mt-9">
                    <SectionLabel>ACCOUNT</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={UserIcon} title="Member since" value="September 2026" iconColor={iconColor} />
                        <ProfileRow icon={GoogleIcon} title="Sign-in method" value="Google" iconColor={iconColor} last />
                    </View>
                </Animated.View>
            </ScrollView>

            <Modal visible={editing} transparent animationType="fade" onRequestClose={closeEditor}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    className="flex-1"
                >
                    <Pressable onPress={closeEditor} className="flex-1 justify-end bg-black/40">
                        <Pressable onPress={(event) => event.stopPropagation()}>
                            <NativeAnimated.View
                                {...panResponder.panHandlers}
                                className="rounded-t-4xl bg-background px-6 pb-10 pt-3"
                                style={{ transform: [{ translateY: sheetTranslateY }] }}
                            >
                                <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-border-strong" />

                                <View className="flex-row items-start justify-between">
                                    <View className="flex-1 pr-5">
                                        <AppText variant="title" className="text-text-high">
                                            Edit profile
                                        </AppText>
                                        <AppText className="mt-2 leading-6 text-text-low">
                                            Keep your personal details current.
                                        </AppText>
                                    </View>
                                    <View className="size-11 items-center justify-center rounded-2xl bg-surface">
                                        <HugeiconsIcon icon={Edit02Icon} size={21} color={iconColor} />
                                    </View>
                                </View>

                                <View className="mt-7">
                                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">
                                        NAME
                                    </AppText>
                                    <View className="h-14 flex-row items-center rounded-2xl border border-border bg-surface px-4">
                                        <HugeiconsIcon icon={UserIcon} size={20} color={iconColor} />
                                        <TextInput
                                            value={draftName}
                                            onChangeText={setDraftName}
                                            autoCapitalize="words"
                                            placeholder="Your name"
                                            placeholderTextColor="#A3A3A3"
                                            className="ml-3 flex-1 text-[16px] text-text-high"
                                        />
                                    </View>
                                </View>

                                <View className="mt-5">
                                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">
                                        EMAIL
                                    </AppText>
                                    <View className="h-14 flex-row items-center rounded-2xl border border-border bg-surface px-4">
                                        <HugeiconsIcon icon={Mail01Icon} size={20} color={iconColor} />
                                        <TextInput
                                            value={draftEmail}
                                            onChangeText={setDraftEmail}
                                            editable={canEditEmail}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            keyboardType="email-address"
                                            textContentType="emailAddress"
                                            placeholder="you@example.com"
                                            placeholderTextColor="#A3A3A3"
                                            className={`ml-3 flex-1 text-[16px] ${canEditEmail ? "text-text-high" : "text-text-disabled"}`}
                                        />
                                    </View>
                                    {!canEditEmail ? (
                                        <AppText variant="caption" className="mt-2 px-1 text-text-low">
                                            Email can only be changed for accounts created with an email sign-in link. This account uses Google.
                                        </AppText>
                                    ) : null}
                                </View>

                                <View className="mt-7 gap-3">
                                    <Button
                                        onPress={saveProfile}
                                        disabled={!draftName.trim() || (canEditEmail && !draftEmail.trim())}
                                    >
                                        <AppText variant="button" className="text-primary-foreground">
                                            Save changes
                                        </AppText>
                                    </Button>
                                    <Button variant="ghost" onPress={closeEditor}>
                                        <AppText variant="button" className="text-text-medium">
                                            Cancel
                                        </AppText>
                                    </Button>
                                </View>

                                <AppText variant="caption" className="mt-3 text-center text-text-disabled">
                                    Profile changes are saved locally until account storage is connected.
                                </AppText>
                            </NativeAnimated.View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

function SectionLabel({ children }: { children: string }) {
    return <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{children}</AppText>;
}

function ProfileRow({ icon, title, value, onPress, iconColor, last = false }: ProfileRowProps & { iconColor: React.ComponentProps<typeof HugeiconsIcon>["color"] }) {
    const content = (
        <>
            <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={icon} size={21} color={iconColor} /></View>
            <View className="flex-1 pr-3">
                <AppText variant="button" className="text-text-high">{title}</AppText>
                <AppText variant="caption" className="mt-1 text-text-low">{value}</AppText>
            </View>
            {onPress ? <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} /> : null}
        </>
    );
    const className = `flex-row items-center px-5 py-5 ${!last ? "border-b border-border" : ""}`;

    return onPress ? (
        <Pressable onPress={onPress} android_ripple={{ color: "rgba(0, 0, 0, 0.06)" }} className={className}>{content}</Pressable>
    ) : (
        <View className={className}>{content}</View>
    );
}
