import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Camera01Icon,
    Clock01Icon,
    Edit02Icon,
    Globe02Icon,
    Mail01Icon,
    SparklesIcon,
    Target01Icon,
    UserIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import BottomSheet from "@/components/ui/BottomSheet";
import IconButton from "@/components/ui/IconButton";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/providers/PreferencesProvider";
import type { SettingsStackParamList } from "@/navigation/routes";
import { avatarService } from "@/services/avatar.service";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { getTimezoneLabel } from "./TimezoneScreen";
import { copy } from "@/constants/copy";
import { useLanguage } from "@/providers/LanguageProvider";

type Props = NativeStackScreenProps<SettingsStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
    const { user, updateName, updateAvatar } = useAuth();
    const { currentNativeName } = useLanguage();
    const { preferences, loading: preferencesLoading } = usePreferences();
    const [draftName, setDraftName] = useState(user?.name ?? "");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const { notice, choose } = useBottomSheet();
    const iconColor = useResolveClassNames("text-text-medium").color;
    const primaryForegroundColor = useResolveClassNames("text-primary-foreground").color;

    useEffect(() => setDraftName(user?.name ?? ""), [user?.name]);
    useEffect(() => setAvatarFailed(false), [user?.avatarUrl]);

    const saveName = async () => {
        if (!draftName.trim() || saving) return;
        try {
            setSaving(true);
            if (draftName.trim() !== user?.name) await updateName(draftName);
            setEditing(false);
        } catch (error) {
            notice(copy.profile.notices.unableToSaveName, error instanceof Error ? error.message : copy.common.pleaseTryAgain);
        } finally {
            setSaving(false);
        }
    };

    const chooseAvatar = async () => {
        if (!user || saving) return;
        // Avatar-only: system picker for a single image. Independent from
        // Connected Sources — never library sync, indexing, or context ingest.
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;
        // A non-cancelled result can still carry no asset: treat it as a
        // normal no-op instead of crashing into the misleading error notice.
        const asset = result.assets?.[0];
        if (!asset) return;

        try {
            setSaving(true);
            const avatarUrl = await avatarService.upload(user.id, asset);
            await updateAvatar(avatarUrl);
        } catch {
            notice(copy.profile.notices.unableToUpdatePhoto, copy.profile.notices.checkConnection);
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
            notice(copy.profile.notices.unableToRemovePhoto, copy.profile.notices.tryAgain);
        } finally {
            setSaving(false);
        }
    };

    const openAvatarMenu = async () => {
        const picked = await choose({
            title: copy.profile.photoSheetTitle,
            options: [
                { label: copy.profile.chooseImage },
                ...(user?.avatarUrl ? [{ label: copy.profile.removePhoto, destructive: true }] : []),
            ],
        });
        if (picked === 0) void chooseAvatar();
        else if (picked === 1) void removeAvatar();
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">{copy.profile.header}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5 items-center">
                    <View className="relative">
                        <View className="size-24 overflow-hidden items-center justify-center rounded-full bg-primary">
                            {user?.avatarUrl && !avatarFailed ? (
                                <Image source={{ uri: user.avatarUrl }} className="size-24" onError={() => setAvatarFailed(true)} accessibilityLabel={copy.profile.photoA11y} />
                            ) : (
                                <HugeiconsIcon icon={UserIcon} size={40} color={primaryForegroundColor} />
                            )}
                        </View>
                        <Pressable onPress={openAvatarMenu} disabled={saving} accessibilityRole="button" accessibilityLabel={copy.profile.changePhotoA11y} className="absolute -bottom-1 -right-1 size-9 items-center justify-center rounded-full border-2 border-background bg-surface">
                            <HugeiconsIcon icon={Camera01Icon} size={18} color={iconColor} />
                        </Pressable>
                    </View>
                    <AppText variant="title" className="mt-4 text-text-high">{user?.name ?? copy.profile.fallbackName}</AppText>
                    <AppText className="mt-1 text-text-low">{user?.email ?? copy.profile.fallbackEmail}</AppText>
                    <Pressable onPress={() => setEditing(true)} className="mt-3 flex-row items-center rounded-full bg-surface px-4 py-2" accessibilityRole="button" accessibilityLabel={copy.profile.editNameA11y}>
                        <HugeiconsIcon icon={Edit02Icon} size={16} color={iconColor} />
                        <AppText variant="caption" className="ml-2 text-text-medium">{copy.profile.editName}</AppText>
                    </Pressable>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <SectionLabel>{copy.profile.aksSection}</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={Target01Icon} title={copy.profile.exploringTitle} value={preferencesLoading ? copy.common.loading : preferences.whatExploring.join(" · ") || copy.profile.exploringEmpty} onPress={() => navigation.navigate("Exploring")} iconColor={iconColor} />
                        <ProfileRow icon={SparklesIcon} title={copy.profile.noticeTitle} value={preferencesLoading ? copy.common.loading : preferences.whatToNotice.join(" · ") || copy.profile.noticeEmpty} onPress={() => navigation.navigate("NoticeAreas")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9">
                    <SectionLabel>{copy.profile.preferencesSection}</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={Clock01Icon} title={copy.profile.timezoneTitle} value={preferencesLoading ? copy.common.loading : getTimezoneLabel(preferences.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone).label} onPress={() => navigation.navigate("Timezone")} iconColor={iconColor} />
                        <ProfileRow icon={Globe02Icon} title={copy.profile.languageTitle} value={currentNativeName} onPress={() => navigation.navigate("Language")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(290)} className="mt-9">
                    <SectionLabel>{copy.profile.accountSection}</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <ProfileRow icon={Mail01Icon} title={copy.profile.emailTitle} value={user?.email ?? copy.profile.emailUnavailable} iconColor={iconColor} />
                        <ProfileRow icon={UserIcon} title={copy.profile.memberSince} value={formatMemberSince(user?.createdAt)} iconColor={iconColor} />
                        <ProfileRow icon={UserIcon} title={copy.profile.signInMethod} value={formatProvider(user?.provider)} iconColor={iconColor} last />
                    </View>
                </Animated.View>
            </ScrollView>

            <BottomSheet
                visible={editing}
                onClose={() => setEditing(false)}
                title={copy.profile.editNameTitle}
                message={copy.profile.editNameMessage}
                body={
                    <TextInput
                        value={draftName}
                        onChangeText={setDraftName}
                        autoCapitalize="words"
                        textContentType="name"
                        accessibilityLabel={copy.profile.nameA11y}
                        placeholder={copy.profile.namePlaceholder}
                        className="h-14 rounded-2xl border border-border bg-background px-4 text-[16px] text-text-high"
                    />
                }
                actions={[
                    { label: saving ? copy.profile.saving : copy.profile.saveChanges, disabled: saving || draftName.trim().length < 2, onPress: () => void saveName() },
                ]}
            />
        </View>
    );
}

function formatProvider(provider?: string | null) {
    if (!provider) return "Email";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatMemberSince(value?: string) {
    if (!value) return "Unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unavailable";
    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
    }).format(date);
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
