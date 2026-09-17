import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, CheckmarkCircle01Icon, FileShredderIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";
import type { PrivacyStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<PrivacyStackParamList, "DeleteData">;
const REMOVED_ITEMS = ["Conversations and messages", "Reflections", "Check-ins", "Derived signals", "Memories and evidence links", "Patterns and evidence links", "Experiments and observations", "Learnings and source links", "Insights and source references"];

export default function DeleteDataScreen({ navigation }: Props) {
    const color = useResolveClassNames("text-text-high").color;
    const muted = useResolveClassNames("text-text-medium").color;
    const { deleting, deleted, error, deleteAccount } = useDeleteAccount();
    const [confirmed, setConfirmed] = useState(false);

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInDown.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={color} /></IconButton>
                <AppText variant="title" className="text-text-high">Delete your data</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                    <AppText variant="display" className="text-text-high">Leave nothing behind.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">Deleting your account permanently removes the data you created in Aks. It also signs you out of this device.</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(500).delay(140)} className="mt-8 rounded-[28px] border border-red-200 bg-red-50 p-5">
                    <AppText variant="title" className="text-red-600">This cannot be undone.</AppText>
                    <AppText className="mt-3 leading-6 text-red-700">Once your account is deleted, your Aks data is gone and cannot be recovered. Consider exporting your data first if you would like a copy.</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(500).delay(210)} className="mt-7 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">WHAT WILL BE REMOVED</AppText>
                    {REMOVED_ITEMS.map((item) => (
                        <View key={item} className="flex-row items-center py-2">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color={muted} />
                            <AppText className="ml-3 text-text-medium">{item}</AppText>
                        </View>
                    ))}
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(500).delay(280)} className="mt-7">
                    <Pressable onPress={() => setConfirmed((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} accessibilityLabel="Confirm that you understand this is permanent" className="flex-row items-start">
                        <View className="mt-0.5 size-6 items-center justify-center rounded-md border border-border bg-background">
                            {confirmed && <View className="size-4 rounded-sm bg-red-600" />}
                        </View>
                        <AppText className="ml-3 flex-1 leading-6 text-text-low">I understand that this action is permanent and that all of my Aks data will be removed.</AppText>
                    </Pressable>

                    {error && (
                        <View className="mt-5 rounded-[28px] border border-red-200 bg-red-50 p-5">
                            <AppText className="leading-6 text-red-700">{error}</AppText>
                        </View>
                    )}

                    <Button onPress={deleteAccount} disabled={!confirmed} loading={deleting} className="mt-7 bg-red-600" accessibilityLabel="Delete my account and data">
                        {!deleting && <HugeiconsIcon icon={FileShredderIcon} size={20} color="#FFFFFF" />}
                        <AppText variant="button" className="ml-2 text-white">{deleting ? "Deleting your account…" : "Delete my account and data"}</AppText>
                    </Button>
                </Animated.View>

                {deleted && (
                    <Animated.View entering={FadeInUp.duration(500)} className="mt-8 items-center">
                        <View className="size-14 items-center justify-center rounded-3xl bg-accent-soft"><HugeiconsIcon icon={CheckmarkCircle01Icon} size={26} color={color} /></View>
                        <AppText variant="title" className="mt-5 text-center text-text-high">Your account is being deleted.</AppText>
                        <AppText className="mt-2 text-center text-text-low">You'll be signed out as the deletion completes.</AppText>
                        <Button variant="ghost" onPress={() => navigation.goBack()} className="mt-6" accessibilityLabel="Return to Settings"><AppText variant="button" className="text-primary">Back to Settings</AppText></Button>
                    </Animated.View>
                )}

                {!deleted && (
                    <Animated.View entering={FadeInUp.duration(500).delay(350)} className="mt-6">
                        <Button variant="ghost" onPress={() => navigation.goBack()} accessibilityLabel="Keep my account"><AppText variant="button" className="text-primary">Keep my account</AppText></Button>
                        <AppText variant="caption" className="mt-4 text-center text-text-low">Deleting your account also removes any export files created for this account.</AppText>
                    </Animated.View>
                )}
            </ScrollView>
        </View>
    );
}