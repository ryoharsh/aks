import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";
import { usePreferences } from "@/providers/PreferencesProvider";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<SettingsStackParamList, "Exploring">;

export default function ExploringScreen({ navigation }: Props) {
    const { preferences, updatePreferences } = usePreferences();
    return <ProfilePreferenceScreen headerTitle={copy.exploring.header} eyebrow={copy.exploring.eyebrow} title={copy.exploring.title} description={copy.exploring.description} options={copy.exploring.options} selections={preferences.whatExploring} onSave={(whatExploring) => updatePreferences({ whatExploring })} multiple onBack={() => navigation.goBack()} />;
}
