import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import IconButton from "@/components/ui/IconButton";
import type { PrivacyStackParamList } from "@/navigation/PrivacyNavigator";

type Props = NativeStackScreenProps<PrivacyStackParamList, "DeleteData">;
const REMOVED_ITEMS = ["Profile information", "Reflections and check-ins", "Experiments and recorded outcomes", "Patterns and learnings"];

export default function DeleteDataScreen({ navigation }: Props) {
    const [confirmed, setConfirmed] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mockComplete, setMockComplete] = useState(false);
    const color = useResolveClassNames("text-text-high").color;
    const muted = useResolveClassNames("text-text-medium").color;

    const confirmDeletion = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setModalVisible(false);
            setMockComplete(true);
        }, 900);
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInDown.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={color} /></IconButton>
                <AppText variant="title" className="text-text-high">Delete your data</AppText>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(70)} className="mt-5">
                    <AppText variant="display" className="text-text-high">Leave nothing behind.</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">Deleting your Aks data is a destructive action. Review what this mock flow represents before continuing.</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(500).delay(140)} className="mt-8 rounded-[28px] border border-red-200 bg-red-50 p-5">
                    <AppText variant="title" className="text-red-600">This cannot be undone.</AppText>
                    <AppText className="mt-3 leading-6 text-red-700">A real deletion request would permanently remove supported account data. Backend deletion is not connected in this prototype.</AppText>
                </Animated.View>
                <Animated.View entering={FadeInUp.duration(500).delay(210)} className="mt-7 rounded-[28px] border border-border bg-surface p-5">
                    <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">WHAT WILL BE REMOVED</AppText>
                    {REMOVED_ITEMS.map((item) => <View key={item} className="flex-row items-center py-2"><HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color={muted} /><AppText className="ml-3 text-text-medium">{item}</AppText></View>)}
                </Animated.View>
                <View className="mt-7 flex-row items-start">
                    <Checkbox
                        checked={confirmed}
                        onCheckedChange={setConfirmed}
                        className="mr-3 mt-0.5"
                        accessibilityLabel="Confirm permanent data deletion"
                    />
                    <AppText className="flex-1 text-text-medium">I understand this action is destructive and cannot be undone.</AppText>
                </View>
                {mockComplete ? <View className="mt-6 rounded-2xl border border-border bg-surface p-4"><AppText variant="button" className="text-text-high">Mock request completed</AppText><AppText variant="caption" className="mt-2 text-text-low">No data was deleted. Connect the backend deletion workflow before enabling this action in production.</AppText></View> : null}
                <Button onPress={() => setModalVisible(true)} disabled={!confirmed || mockComplete} className="mt-7 bg-red-600"><AppText variant="button" className="text-white">Delete my data</AppText></Button>
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 items-center justify-center bg-black/40 px-6">
                    <Animated.View entering={FadeIn.duration(220)} className="w-full rounded-[28px] bg-background p-6">
                        <AppText variant="title" className="text-text-high">Delete permanently?</AppText>
                        <AppText className="mt-3 leading-6 text-text-low">This action cannot be undone. This prototype will only simulate the request and will not delete data.</AppText>
                        <View className="mt-6 gap-3">
                            <Button variant="secondary" onPress={() => setModalVisible(false)}><AppText variant="button" className="text-text-high">Cancel</AppText></Button>
                            <Button onPress={confirmDeletion} loading={loading} className="bg-red-600"><AppText variant="button" className="text-white">Delete permanently</AppText></Button>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}
