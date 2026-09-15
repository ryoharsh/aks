import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Exploring">;

export default function ExploringScreen({ navigation }: Props) {
    return <ProfilePreferenceScreen headerTitle="What you're exploring" eyebrow="PERSONAL" title="Choose your focus." description="Select the areas you want to understand more clearly." options={["Focus", "Energy", "Sleep", "Mood", "Habits", "Stress"]} initialSelections={["Focus", "Energy", "Sleep"]} multiple onBack={() => navigation.goBack()} />;
}
