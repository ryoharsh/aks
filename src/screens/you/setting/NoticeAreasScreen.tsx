import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";
import { usePreferences } from "@/providers/PreferencesProvider";

type Props = NativeStackScreenProps<SettingsStackParamList, "NoticeAreas">;

export default function NoticeAreasScreen({ navigation }: Props) {
    const { preferences, updatePreferences } = usePreferences();
    return <ProfilePreferenceScreen headerTitle="What Aks should notice" eyebrow="PERSONAL" title="Guide what Aks notices." description="Choose the areas Aks should prioritize when organizing possible patterns." options={["Daily routines", "Energy changes", "Focus patterns", "Sleep quality", "Mood shifts", "Experiment outcomes"]} selections={preferences.whatToNotice} onSave={(whatToNotice) => updatePreferences({ whatToNotice })} multiple onBack={() => navigation.goBack()} />;
}
