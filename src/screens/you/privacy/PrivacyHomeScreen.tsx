import { Pressable, ScrollView, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { ArrowLeft01Icon, ArrowRight01Icon, Database01Icon, Delete02Icon, Download01Icon, EyeIcon, InformationCircleIcon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import type { PrivacyStackParamList } from "@/navigation/PrivacyNavigator";
import type { RootStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<PrivacyStackParamList, "PrivacyHome">;
type Item = { icon: IconSvgElement; title: string; description: string; onPress: () => void; destructive?: boolean };

export default function PrivacyHomeScreen({ navigation }: Props) {
    const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();
    const iconColor = useResolveClassNames("text-text-medium").color;
    const sections: { label: string; items: Item[] }[] = [
        {
            label: "YOUR DATA", items: [
                { icon: Database01Icon, title: "What Aks knows", description: "Understand the information used to create your experience.", onPress: () => navigation.navigate("DataUsage") },
                { icon: EyeIcon, title: "What Aks can access", description: "Review what you provide or choose to connect.", onPress: () => navigation.navigate("DataAccess") },
            ]
        },
        {
            label: "DATA CONTROLS", items: [
                { icon: InformationCircleIcon, title: "How your data is used", description: "See how information supports insights and experiments.", onPress: () => navigation.navigate("DataUsage") },
                { icon: Download01Icon, title: "Export your data", description: "Request a copy of your Aks information.", onPress: () => navigation.navigate("ExportData") },
                { icon: Delete02Icon, title: "Delete your data", description: "Start a careful account data deletion request.", onPress: () => navigation.navigate("DeleteData"), destructive: true },
            ]
        },
        {
            label: "LEGAL", items: [
                { icon: ShieldCheckIcon, title: "Privacy Policy", description: "Read the full Aks Privacy Policy.", onPress: () => rootNavigation.navigate("PrivacyPolicy") },
            ]
        },
    ];

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">Privacy</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <AppText variant="caption" className="mb-2 tracking-[1.5px] text-text-low">YOUR PRIVACY</AppText>
                    <AppText variant="display" className="text-text-high">Your life is yours.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">Aks helps you understand yourself while keeping you in control of the information behind your experience.</AppText>
                </Animated.View>
                {sections.map((section, sectionIndex) => (
                    <Animated.View key={section.label} entering={FadeInUp.duration(450).delay(150 + sectionIndex * 70)} className="mt-9">
                        <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{section.label}</AppText>
                        <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                            {section.items.map((item, index) => (
                                <Pressable key={item.title} onPress={item.onPress} className={`flex-row items-center px-5 py-5 ${index < section.items.length - 1 ? "border-b border-border" : ""}`}>
                                    <View className="mr-4 size-11 items-center justify-center rounded-2xl bg-background">
                                        <HugeiconsIcon icon={item.icon} size={21} color={iconColor} />
                                    </View>
                                    <View className="flex-1 pr-3">
                                        <AppText variant="button" className={item.destructive ? "text-red-500" : "text-text-high"}>{item.title}</AppText>
                                        <AppText variant="caption" className="mt-1 text-text-low">{item.description}</AppText>
                                    </View>
                                    <HugeiconsIcon icon={ArrowRight01Icon} size={19} color={iconColor} />
                                </Pressable>
                            ))}
                        </View>
                    </Animated.View>
                ))}
            </ScrollView>
        </View>
    );
}
