import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Language">;

export default function LanguageScreen({ navigation }: Props) {
    return <ProfilePreferenceScreen headerTitle="Language" eyebrow="PREFERENCES" title="Choose your language." description="Select the language used throughout Aks." options={["English", "Hindi", "Spanish", "French", "German"]} initialSelections={["English"]} onBack={() => navigation.goBack()} />;
}
