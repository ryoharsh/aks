import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Language">;

export default function LanguageScreen({ navigation }: Props) {
    return <ProfilePreferenceScreen headerTitle="Language" eyebrow="PREFERENCES" title="Device language" description="Aks currently follows your device language. A persistent preference will be added with localization." options={["English"]} selections={["English"]} onSave={async () => {}} onBack={() => navigation.goBack()} />;
}
