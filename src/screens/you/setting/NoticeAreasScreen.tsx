import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";
import { usePreferences } from "@/providers/PreferencesProvider";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<SettingsStackParamList, "NoticeAreas">;

export default function NoticeAreasScreen({ navigation }: Props) {
    const { preferences, updatePreferences } = usePreferences();
    return <ProfilePreferenceScreen headerTitle={copy.noticeAreas.header} eyebrow={copy.noticeAreas.eyebrow} title={copy.noticeAreas.title} description={copy.noticeAreas.description} options={copy.noticeAreas.options} selections={preferences.whatToNotice} onSave={(whatToNotice) => updatePreferences({ whatToNotice })} multiple onBack={() => navigation.goBack()} />;
}
