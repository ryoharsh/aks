import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Camera01Icon,
    Clock01Icon,
    Edit02Icon,
    Globe02Icon,
    GoogleIcon,
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
type ProfileRowProps = {
    icon: IconSvgElement;
    title: string;
    value: string;
    onPress?: () => void;
    last?: boolean;
};

export default function ProfileScreen({ navigation }: Props) {
    const [name, setName] = useState("Harsh");
    const [draftName, setDraftName] = useState(name);
    const [editing, setEditing] = useState(false);
    const iconColor = useResolveClassNames("text-text-medium").color;

    const saveName = () => {
        const nextName = draftName.trim();
        if (!nextName) return;
        setName(nextName);
        setEditing(false);
    };

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
                        <Pressable onPress={() => setEditing(true)} className="absolute -bottom-1 -right-1 size-9 items-center justify-center rounded-full border-2 border-background bg-surface">
                            <HugeiconsIcon icon={Camera01Icon} size={18} color={iconColor} />
                        </Pressable>
                    </View>
                    <AppText variant="title" className="mt-4 text-text-high">{name}</AppText>
                    <Pressable onPress={() => setEditing(true)} className="mt-2 flex-row items-center rounded-full bg-surface px-4 py-2">
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

            <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
                <View className="flex-1 items-center justify-center bg-black/40 px-6">
                    <Animated.View entering={FadeIn.duration(220)} className="w-full rounded-[28px] bg-background p-6">
                        <AppText variant="title" className="text-text-high">Edit profile</AppText>
                        <AppText className="mt-2 text-text-low">Update how your name appears in Aks.</AppText>
                        <TextInput
                            value={draftName}
                            onChangeText={setDraftName}
                            autoCapitalize="words"
                            placeholder="Your name"
                            placeholderTextColor="#A3A3A3"
                            className="mt-5 h-14 rounded-2xl border border-border bg-surface px-4 text-[16px] text-text-high"
                        />
                        <View className="mt-5 gap-3">
                            <Button onPress={saveName} disabled={!draftName.trim()}><AppText variant="button" className="text-primary-foreground">Save changes</AppText></Button>
                            <Button variant="secondary" onPress={() => { setDraftName(name); setEditing(false); }}><AppText variant="button" className="text-text-high">Cancel</AppText></Button>
                        </View>
                        <AppText variant="caption" className="mt-4 text-center text-text-disabled">Avatar upload can be connected when account storage is available.</AppText>
                    </Animated.View>
                </View>
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
