import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import type { PrivacyStackParamList } from "@/navigation/PrivacyNavigator";

type Props = NativeStackScreenProps<PrivacyStackParamList, "DataAccess">;
const ITEMS = [
    ["Information you provide", "Details you enter directly into Aks, such as profile information and preferences."],
    ["Reflections and check-ins", "Entries you create to describe your experiences, mood, focus, energy, or routines."],
    ["Experiment data", "Experiments you create and the outcomes or notes you record."],
    ["Account information", "Basic information needed to identify and manage your Aks account."],
    ["Connected data sources", "Only information from services you explicitly choose to connect, where those connections are available."],
] as const;

export default function DataAccessScreen({ navigation }: Props) {
    const color = useResolveClassNames("text-text-high").color;
    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInDown.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={color} /></IconButton>
                <AppText variant="title" className="text-text-high">What Aks can access</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                    <AppText variant="display" className="text-text-high">Clear by design.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">Aks works with information you provide and data sources you deliberately choose to connect.</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(500).delay(140)} className="mt-8 gap-3">
                    {ITEMS.map(([title, body]) => (
                        <View key={title} className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="button" className="text-text-high">{title}</AppText>
                            <AppText className="mt-2 leading-6 text-text-low">{body}</AppText>
                        </View>
                    ))}
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(500).delay(230)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <View className="mb-3 size-10 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={ShieldCheckIcon} size={21} color={color} /></View>
                    <AppText variant="title" className="text-text-high">You're in control</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">You decide what information to enter and which supported sources to connect. Aks does not imply access to device information you have not provided or authorized.</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}
