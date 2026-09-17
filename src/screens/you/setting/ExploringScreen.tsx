import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";
import { usePreferences } from "@/providers/PreferencesProvider";

type Props = NativeStackScreenProps<SettingsStackParamList, "Exploring">;

export default function ExploringScreen({ navigation }: Props) {
    const { preferences, updatePreferences } = usePreferences();
    return <ProfilePreferenceScreen headerTitle="What you're exploring" eyebrow="PERSONAL" title="Choose your focus." description="Select the areas you want to understand more clearly." options={["Focus", "Energy", "Sleep", "Mood", "Habits", "Stress"]} selections={preferences.whatExploring} onSave={(whatExploring) => updatePreferences({ whatExploring })} multiple onBack={() => navigation.goBack()} />;
}
