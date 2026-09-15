import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { YouStackParamList } from "./routes";

import YouScreen from "@/screens/you/YouScreen";
import NotificationsScreen from "@/screens/you/notification/NotificationsScreen";
import AppearanceScreen from "@/screens/you/appearance/AppearanceScreen";
import HelpFeedbackNavigator from "@/navigation/HelpFeedbackNavigator";
import PrivacyNavigator from "@/navigation/PrivacyNavigator";
import YourDataNavigator from "@/navigation/YourDataNavigator";
import SettingsNavigator from "@/navigation/SettingsNavigator";

const Stack = createNativeStackNavigator<YouStackParamList>();

export default function YouNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="YouHome"
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen
                name="YouHome"
                component={YouScreen}
            />

            <Stack.Screen
                name="YourData"
                component={YourDataNavigator}
            />

            <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
            />

            <Stack.Screen
                name="Appearance"
                component={AppearanceScreen}
            />

            <Stack.Screen
                name="Privacy"
                component={PrivacyNavigator}
            />

            <Stack.Screen
                name="HelpFeedback"
                component={HelpFeedbackNavigator}
            />

            <Stack.Screen
                name="Settings"
                component={SettingsNavigator}
            />
        </Stack.Navigator>
    );
}