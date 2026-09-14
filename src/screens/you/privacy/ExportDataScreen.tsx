import { useState } from "react";
import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import type { PrivacyStackParamList } from "@/navigation/PrivacyNavigator";

type Props = NativeStackScreenProps<PrivacyStackParamList, "ExportData">;
type RequestState = "idle" | "loading" | "success" | "error";
const INCLUDED = ["Profile information", "Reflections", "Check-ins", "Experiments", "Patterns", "Learnings"];

export default function ExportDataScreen({ navigation }: Props) {
    const [requestState, setRequestState] = useState<RequestState>("idle");
    const color = useResolveClassNames("text-text-high").color;
    const muted = useResolveClassNames("text-text-medium").color;

    const requestExport = () => {
        if (requestState === "loading") return;
        setRequestState("loading");
        setTimeout(() => {
            try {
                setRequestState("success");
            } catch {
                setRequestState("error");
            }
        }, 900);
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInDown.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={color} /></IconButton>
                <AppText variant="title" className="text-text-high">Export your data</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="flex-grow px-5 pb-24">
                {requestState === "success" ? (
                    <Animated.View entering={FadeInUp.duration(500)} className="flex-1 items-center justify-center py-16">
                        <View className="size-16 items-center justify-center rounded-[28px] bg-surface"><HugeiconsIcon icon={CheckmarkCircle01Icon} size={31} color={color} /></View>
                        <AppText variant="display" className="mt-6 text-center text-text-high">Your request is on its way.</AppText>
                        <AppText className="mt-3 text-center leading-6 text-text-low">This is currently a mock request. Connect the export backend before treating an export as generated or delivered.</AppText>
                        <Button onPress={() => navigation.goBack()} className="mt-8 w-full"><AppText variant="button" className="text-primary-foreground">Go back</AppText></Button>
                    </Animated.View>
                ) : (
                    <>
                        <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                            <AppText variant="display" className="text-text-high">Take your data with you.</AppText>
                            <AppText className="mt-3 leading-6 text-text-low">Request a copy of information associated with your Aks experience. Export delivery requires backend support and is mocked for now.</AppText>
                        </Animated.View>
                        <Animated.View entering={FadeInUp.duration(500).delay(150)} className="mt-8 rounded-[28px] border border-border bg-surface p-5">
                            <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">WHAT CAN BE INCLUDED</AppText>
                            {INCLUDED.map((item) => (
                                <View key={item} className="flex-row items-center py-2">
                                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color={muted} />
                                    <AppText className="ml-3 text-text-medium">{item}</AppText>
                                </View>
                            ))}
                        </Animated.View>
                        {requestState === "error" ? <AppText className="mt-5 text-center text-red-500">The mock request could not be completed. Please try again.</AppText> : null}
                        <Animated.View entering={FadeInUp.duration(500).delay(230)} className="mt-7">
                            <Button onPress={requestExport} loading={requestState === "loading"}><AppText variant="button" className="text-primary-foreground">Request data export</AppText></Button>
                        </Animated.View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
