import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, Delete02Icon, Logout01Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { useAuth } from "@/hooks/useAuth";
import type { SettingsStackParamList } from "@/navigation/routes";
import { accountService } from "@/services/account.service";
import { useBottomSheet } from "@/components/ui/BottomSheetProvider";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<SettingsStackParamList, "Account">;

export default function AccountScreen({ navigation }: Props) {
    const { user, signOut } = useAuth();
    const { confirm, notice } = useBottomSheet();
    const iconColor = useResolveClassNames("text-text-medium").color;

    const confirmSignOut = async () => {
        const ok = await confirm({ title: copy.account.confirmSignOutTitle, message: copy.account.confirmSignOutMessage, confirmLabel: copy.account.signOut });
        if (!ok) return;
        try { await signOut(); } catch { notice(copy.account.notices.unableToSignOut, copy.common.pleaseTryAgain); }
    };

    const confirmDeletion = async () => {
        const ok = await confirm({ title: copy.account.confirmDeleteTitle, message: copy.account.confirmDeleteMessage, confirmLabel: copy.account.deleteAccount });
        if (!ok) return;
        try {
            await accountService.requestDeletion();
            await signOut().catch(() => undefined);
        } catch {
            notice(copy.account.notices.unableToDelete, copy.account.notices.deleteUnavailable);
        }
    };

    return (
        <View className="flex-1 bg-background">
            <View className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton>
                <AppText variant="title" className="text-text-high">{copy.account.header}</AppText>
            </View>
            <ScrollView contentContainerClassName="px-5 pb-24">
                <AppText variant="caption" className="mt-5 tracking-[1.5px] text-text-low">{copy.account.signedInAs}</AppText>
                <View className="mt-3 flex-row items-center rounded-[28px] border border-border bg-surface p-5">
                    <HugeiconsIcon icon={Mail01Icon} size={21} color={iconColor} />
                    <AppText className="ml-3 flex-1 text-text-high">{user?.email ?? copy.account.emailUnavailable}</AppText>
                </View>
                <View className="mt-8 overflow-hidden rounded-[28px] border border-border bg-surface">
                    <Pressable onPress={confirmSignOut} accessibilityRole="button" className="flex-row items-center border-b border-border p-5">
                        <HugeiconsIcon icon={Logout01Icon} size={21} color={iconColor} />
                        <AppText variant="button" className="ml-3 text-text-high">{copy.account.signOut}</AppText>
                    </Pressable>
                    <Pressable onPress={confirmDeletion} accessibilityRole="button" className="flex-row items-center p-5">
                        <HugeiconsIcon icon={Delete02Icon} size={21} color="#DC2626" />
                        <AppText variant="button" className="ml-3 text-red-600">{copy.account.deleteAccount}</AppText>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}
