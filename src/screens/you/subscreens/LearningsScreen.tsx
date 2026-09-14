import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppText from "@/components/ui/Text";
import type { YouStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<YouStackParamList, "Learnings">;

export default function LearningsScreen({ navigation }: Props) {
    return (
        <View className="flex-1 bg-background px-6 pt-8">
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
                <AppText variant="button" className="text-text-high">Back</AppText>
            </Pressable>
            <AppText variant="title" className="mt-8 text-text-high">Learnings</AppText>
        </View>
    );
}
