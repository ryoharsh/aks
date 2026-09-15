import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { InformationCircleIcon, SparklesIcon } from "@hugeicons/core-free-icons";

import SettingsDetailScreen from "@/components/setting/SettingsDetailScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "About">;

export default function AboutAksScreen({ navigation }: Props) {
    return (
        <SettingsDetailScreen
            headerTitle="About Aks"
            eyebrow="ABOUT"
            title="Understand yourself, differently."
            description="Aks helps you reflect on your activity, notice possible patterns, and run personal experiments with more intention."
            items={[
                { label: "Product", value: "Aks.ai", icon: SparklesIcon },
                { label: "Version", value: "1.0.0", icon: InformationCircleIcon },
            ]}
            note="Aks supports personal reflection and does not replace professional medical or mental-health advice."
            onBack={() => navigation.goBack()}
        />
    );
}
