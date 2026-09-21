import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { InformationCircleIcon, SparklesIcon } from "@hugeicons/core-free-icons";

import SettingsDetailScreen from "@/components/setting/SettingsDetailScreen";
import type { SettingsStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<SettingsStackParamList, "About">;

export default function AboutAksScreen({ navigation }: Props) {
    return (
        <SettingsDetailScreen
            headerTitle={copy.about.header}
            eyebrow={copy.about.eyebrow}
            title={copy.about.title}
            description={copy.about.description}
            items={[
                { label: copy.about.productLabel, value: copy.about.productValue, icon: SparklesIcon },
                { label: copy.about.versionLabel, value: copy.about.versionValue, icon: InformationCircleIcon },
            ]}
            note={copy.about.note}
            onBack={() => navigation.goBack()}
        />
    );
}
