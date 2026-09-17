import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Timezone">;

export default function TimezoneScreen({ navigation }: Props) {
    return <ProfilePreferenceScreen headerTitle="Timezone" eyebrow="PREFERENCES" title="Device timezone" description="Aks uses the timezone reported by your device. A persistent choice will only be added when scheduling requires it." options={[Intl.DateTimeFormat().resolvedOptions().timeZone]} selections={[Intl.DateTimeFormat().resolvedOptions().timeZone]} onSave={async () => {}} onBack={() => navigation.goBack()} />;
}
