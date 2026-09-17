import { useEffect, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Camera01Icon,
    Edit02Icon,
    Mail01Icon,
    SparklesIcon,
    Target01Icon,
    UserIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/providers/PreferencesProvider";
import type { SettingsStackParamList } from "@/navigation/routes";
import { avatarService } from "@/services/avatar.service";

type Props = NativeStackScreenProps<SettingsStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
    const { user, updateName, updateAvatar } = useAuth();
    const { preferences, loading: preferencesLoading } = usePreferences();
    const [draftName, setDraftName] = useState(user?.name ?? "");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const iconColor = useResolveClassNames("text-text-medium").color;

    useEffect(() => setDraftName(user?.name ?? ""), [user?.name]);
    useEffect(() => setAvatarFailed(false), [user?.avatarUrl]);

    const saveName = async () => {
        if (!draftName.trim() || saving) return;
        try {
            setSaving(true);
            if (draftName.trim() !== user?.name) await updateName(draftName);
            setEditing(false);
        } catch (error) {
            Alert.alert("Unable to save profile", error instanceof Error ? error.message : "Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const chooseAvatar = async () => {
        if (!user || saving) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;

        try {
            setSaving(true);
            const avatarUrl = await avatarService.upload(user.id, result.assets[0]);
            await updateAvatar(avatarUrl);
        } catch {
            Alert.alert("Unable to update photo", "Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const removeAvatar = async () => {
        if (!user || saving) return;
        try {
            setSaving(true);
            await avatarService.remove(user.id);
            await updateAvatar(null);
        } catch {
            Alert.alert("Unable to remove photo", "Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const openAvatarMenu = () => {
        Alert.alert("Profile photo", undefined, [
            { text: "Choose image", onPress: () => void chooseAvatar() },
            ...(user?.avatarUrl ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => void removeAvatar() }] : []),
            { text: "Cancel", style: "cancel" },
        ]);
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">Profile</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5 items-center">
                    <View className="relative">
                        <View className="size-24 overflow-hidden items-center justify-center rounded-full bg-primary">
                            {user?.avatarUrl && !avatarFailed ? (
                                <Image source={{ uri: user.avatarUrl }} className="size-24" onError={() => setAvatarFailed(true)} accessibilityLabel="Profile photo" />
                            ) : (
                                <HugeiconsIcon icon={UserIcon} size={40} color="#FFFFFF" />
                            )}
                        </View>
                        <Pressable onPress={openAvatarMenu} disabled={saving} accessibilityRole="button" accessibilityLabel="Change profile photo" className="absolute -bottom-1 -right-1 size-9 items-center justify-center rounded-full border-2 border-background bg-surface">
                            <HugeiconsIcon icon={Camera01Icon} size={18} color={iconColor} />
                        </Pressable>
                    </View>
                    <AppText variant="title" className="mt-4 text-text-high">{user?.name ?? "Aks member"}</AppText>
                    <AppText className="mt-1 text-text-low">{user?.email ?? "Email unavailable"}</AppText>
                    <Pressable onPress={() => setEditing(true)} className="mt-3 flex-row items-center rounded-full bg-surface px-4 py-2" accessibilityRole="button" accessibilityLabel="Edit name">
                        <HugeiconsIcon icon={Edit02Icon} size={16} color={iconColor} />
                        <AppText variant="caption" className="ml-2 text-text-medium">Edit name</AppText>
                    </Pressable>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <SectionLabel>AKS</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={Target01Icon} title="What you're exploring" value={preferencesLoading ? "Loading..." : preferences.whatExploring.join(" · ") || "Not set"} onPress={() => navigation.navigate("Exploring")} iconColor={iconColor} />
                        <ProfileRow icon={SparklesIcon} title="What Aks should notice" value={preferencesLoading ? "Loading..." : preferences.whatToNotice.join(" · ") || "Not set"} onPress={() => navigation.navigate("NoticeAreas")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <SectionLabel>ACCOUNT</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={Mail01Icon} title="Email" value={user?.email ?? "Unavailable"} iconColor={iconColor} />
                        <ProfileRow icon={UserIcon} title="Sign-in method" value={formatProvider(user?.provider)} iconColor={iconColor} last />
                    </View>
                </Animated.View>
            </ScrollView>

            <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
                <Pressable onPress={() => setEditing(false)} className="flex-1 justify-end bg-black/40">
                    <Pressable onPress={(event) => event.stopPropagation()} className="rounded-t-4xl bg-background px-6 pb-10 pt-6">
                        <AppText variant="title" className="text-text-high">Edit your name</AppText>
                        <TextInput
                            value={draftName}
                            onChangeText={setDraftName}
                            autoCapitalize="words"
                            textContentType="name"
                            accessibilityLabel="Full name"
                            className="mt-6 h-14 rounded-2xl border border-border bg-surface px-4 text-[16px] text-text-high"
                        />
                        <Button onPress={() => void saveName()} loading={saving} disabled={draftName.trim().length < 2} className="mt-5" accessibilityLabel="Save name">
                            <AppText variant="button" className="text-primary-foreground">Save changes</AppText>
                        </Button>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

function formatProvider(provider?: string | null) {
    if (!provider) return "Email";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function SectionLabel({ children }: { children: string }) {
    return <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{children}</AppText>;
}

function ProfileRow({ icon, title, value, onPress, iconColor, last = false }: {
    icon: IconSvgElement;
    title: string;
    value: string;
    onPress?: () => void;
    iconColor: React.ComponentProps<typeof HugeiconsIcon>["color"];
    last?: boolean;
}) {
    const content = <><View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={icon} size={21} color={iconColor} /></View><View className="flex-1 pr-3"><AppText variant="button" className="text-text-high">{title}</AppText><AppText variant="caption" numberOfLines={2} className="mt-1 text-text-low">{value}</AppText></View>{onPress ? <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} /> : null}</>;
    const className = `flex-row items-center px-5 py-5 ${!last ? "border-b border-border" : ""}`;
    return onPress ? <Pressable onPress={onPress} className={className}>{content}</Pressable> : <View className={className}>{content}</View>;
}
