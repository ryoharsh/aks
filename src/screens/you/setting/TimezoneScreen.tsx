import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Timezone">;

export default function TimezoneScreen({ navigation }: Props) {
    return <ProfilePreferenceScreen headerTitle="Timezone" eyebrow="PREFERENCES" title="Your local time." description="Choose the timezone Aks should use when showing dates and scheduling reminders." options={["IST · India Standard Time", "UTC · Coordinated Universal Time", "EST · Eastern Time", "PST · Pacific Time", "GMT · Greenwich Mean Time"]} initialSelections={["IST · India Standard Time"]} onBack={() => navigation.goBack()} />;
}
