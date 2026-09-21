import { Pressable, ScrollView, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    CreditCardIcon,
    Globe02Icon,
    InformationCircleIcon,
    ShieldCheckIcon,
    UserIcon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { copy } from "@/constants/copy";
import { useLanguage } from "@/providers/LanguageProvider";
import type {
    RootStackParamList,
    SettingsStackParamList,
} from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "SettingsHome">;
type SettingsRowProps = {
    icon: IconSvgElement;
    title: string;
    description?: string;
    onPress: () => void;
    last?: boolean;
    destructive?: boolean;
};

export default function SettingsScreen({ navigation }: Props) {
    const { currentNativeName } = useLanguage();
    const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();
    const iconColor = useResolveClassNames("text-text-medium").color;

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">{copy.settings.header}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">{copy.settings.eyebrow}</AppText>
                    <AppText variant="display" className="text-text-high">{copy.settings.title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">{copy.settings.description}</AppText>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                    <SectionLabel>{copy.settings.accountSection}</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <SettingsRow icon={UserIcon} title={copy.settings.profileTitle} description={copy.settings.profileDescription} onPress={() => navigation.navigate("Profile")} iconColor={iconColor} />
                        <SettingsRow icon={ShieldCheckIcon} title={copy.settings.accountTitle} description={copy.settings.accountDescription} onPress={() => navigation.navigate("Account")} iconColor={iconColor} />
                        <SettingsRow icon={CreditCardIcon} title={copy.settings.subscriptionTitle} description={copy.settings.subscriptionDescription} onPress={() => navigation.navigate("Subscription")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(290)} className="mt-9">
                    <SectionLabel>{copy.settings.preferencesSection}</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <SettingsRow icon={Globe02Icon} title={copy.settings.languageTitle} description={currentNativeName} onPress={() => navigation.navigate("Language")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(360)} className="mt-9">
                    <SectionLabel>{copy.settings.aboutSection}</SectionLabel>
                    <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                        <SettingsRow icon={InformationCircleIcon} title={copy.settings.aboutTitle} description={copy.settings.aboutDescription} onPress={() => navigation.navigate("About")} iconColor={iconColor} />
                        <SettingsRow icon={ShieldCheckIcon} title={copy.settings.termsTitle} onPress={() => rootNavigation.navigate("Terms")} iconColor={iconColor} />
                        <SettingsRow icon={ShieldCheckIcon} title={copy.settings.privacyTitle} onPress={() => rootNavigation.navigate("PrivacyPolicy")} iconColor={iconColor} last />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(450).delay(500)} className="mt-9 items-center">
                    <AppText variant="caption" className="text-text-disabled">{copy.common.version("1.0.0")}</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

function SectionLabel({ children }: { children: string }) {
    return <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{children}</AppText>;
}

function SettingsRow({ icon, title, description, onPress, iconColor, last = false, destructive = false }: SettingsRowProps & { iconColor: React.ComponentProps<typeof HugeiconsIcon>["color"] }) {
    return (
        <Pressable onPress={onPress} android_ripple={{ color: "rgba(0, 0, 0, 0.06)" }} className={`flex-row items-center px-5 py-5 ${!last ? "border-b border-border" : ""}`}>
            <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                <HugeiconsIcon icon={icon} size={21} color={destructive ? "#DC2626" : iconColor} />
            </View>
            <View className="flex-1 pr-3">
                <AppText variant="button" className={destructive ? "text-red-600" : "text-text-high"}>{title}</AppText>
                {description ? <AppText variant="caption" className="mt-1 text-text-low">{description}</AppText> : null}
            </View>
            {!destructive ? <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} /> : null}
        </Pressable>
    );
}
