import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, Database01Icon, Link01Icon, Plug01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import { useDataAccess } from "@/hooks/useDataAccess";
import type { PrivacyStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<PrivacyStackParamList, "DataAccess">;
const ACCESS_ITEMS = [
    ["Information you provide", "Details you enter directly into Aks, such as profile information and preferences."],
    ["Reflections and check-ins", "Entries you create to describe your experiences, mood, focus, energy, or routines."],
    ["Experiment data", "Experiments you create and the outcomes or notes you record."],
    ["Account information", "Basic information needed to identify and manage your Aks account."],
    ["Connected data sources", "Only information from services you explicitly choose to connect, where those connections are available."],
] as const;

function displayName(source_type: string, name: string): string {
    const pretty = source_type
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    return `${pretty} · ${name}`;
}

export default function DataAccessScreen({ navigation }: Props) {
    const color = useResolveClassNames("text-text-high").color;
    const muted = useResolveClassNames("text-text-medium").color;
    const { loading, sources, error } = useDataAccess();

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

                <Animated.View entering={FadeInUp.duration(500).delay(130)} className="mt-8">
                    <View className="mb-3 flex-row items-center">
                        <HugeiconsIcon icon={Plug01Icon} size={17} color={muted} />
                        <AppText variant="caption" className="ml-2 flex-1 tracking-[1.5px] text-text-low">CONNECTED SOURCES</AppText>
                    </View>
                    {loading && (
                        <View className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText className="text-text-low">Loading your connected sources…</AppText>
                        </View>
                    )}
                    {!loading && error && (
                        <View className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText className="text-text-low">We couldn't load your connected sources right now.</AppText>
                            <AppText className="mt-1 text-text-medium">{error}</AppText>
                        </View>
                    )}
                    {!loading && !error && sources.length === 0 && (
                        <View className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="button" className="text-text-high">No connected sources yet</AppText>
                            <AppText className="mt-2 leading-6 text-text-low">Aks reads from external services only after you explicitly connect them. You can manage any connection from your account settings.</AppText>
                        </View>
                    )}
                    {!loading && !error && sources.length > 0 && (
                        <View className="gap-2">
                            {sources.map((source) => {
                                const connected = source.enabled && !source.disconnected_at;
                                return (
                                    <View key={source.source_type} className="flex-row items-center rounded-[28px] border border-border bg-surface p-5">
                                        <View className="size-10 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={Link01Icon} size={19} color={color} /></View>
                                        <View className="ml-3 flex-1">
                                            <AppText variant="button" className="text-text-high">{displayName(source.source_type, source.name)}</AppText>
                                            <View className="mt-1 flex-row items-center">
                                                <HugeiconsIcon icon={Database01Icon} size={14} color={muted} />
                                                <AppText className="ml-1.5 text-text-medium">{connected ? "Connected and reading data" : "Not connected"}</AppText>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(500).delay(190)} className="mt-8 gap-3">
                    <AppText variant="caption" className="tracking-[1.5px] text-text-low">WHAT AKS HOLDS</AppText>
                    {ACCESS_ITEMS.map(([title, body]) => (
                        <View key={title} className="rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="button" className="text-text-high">{title}</AppText>
                            <AppText className="mt-2 leading-6 text-text-low">{body}</AppText>
                        </View>
                    ))}
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(500).delay(250)} className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                    <View className="mb-3 size-10 items-center justify-center rounded-2xl bg-background"><HugeiconsIcon icon={ShieldCheckIcon} size={21} color={color} /></View>
                    <AppText variant="title" className="text-text-high">You're in control</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">You decide what information to enter and which supported sources to connect. Aks does not imply access to device information you have not provided or authorized.</AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}