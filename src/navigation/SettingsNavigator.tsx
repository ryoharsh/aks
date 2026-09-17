import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SettingsScreen from "@/screens/you/setting/SettingsScreen";
import ProfileScreen from "@/screens/you/setting/ProfileScreen";
import ExploringScreen from "@/screens/you/setting/ExploringScreen";
import NoticeAreasScreen from "@/screens/you/setting/NoticeAreasScreen";
import TimezoneScreen from "@/screens/you/setting/TimezoneScreen";
import LanguageScreen from "@/screens/you/setting/LanguageScreen";
import SubscriptionScreen from "@/screens/you/setting/SubscriptionScreen";
import AboutAksScreen from "@/screens/you/setting/AboutAksScreen";
import AccountScreen from "@/screens/you/setting/AccountScreen";
import type { SettingsStackParamList } from "@/navigation/routes";

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="SettingsHome"
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="SettingsHome" component={SettingsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
            <Stack.Screen name="Exploring" component={ExploringScreen} />
            <Stack.Screen name="NoticeAreas" component={NoticeAreasScreen} />
            <Stack.Screen name="Timezone" component={TimezoneScreen} />
            <Stack.Screen name="Language" component={LanguageScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="About" component={AboutAksScreen} />
        </Stack.Navigator>
    );
}
