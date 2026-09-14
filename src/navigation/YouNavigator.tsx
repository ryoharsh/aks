import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { YouStackParamList } from "./routes";

import YouScreen from "@/screens/you/YouScreen";
import PatternsScreen from "@/screens/you/subscreens/PatternsScreen";
import ExperimentsScreen from "@/screens/you/subscreens/ExperimentsScreen";
import LearningsScreen from "@/screens/you/subscreens/LearningsScreen";
import YourDataScreen from "@/screens/you/subscreens/YourDataScreen";
import NotificationsScreen from "@/screens/you/subscreens/NotificationsScreen";
import AppearanceScreen from "@/screens/you/subscreens/AppearanceScreen";
import PrivacyScreen from "@/screens/you/subscreens/PrivacyScreen";
import HelpFeedbackScreen from "@/screens/you/subscreens/HelpFeedbackScreen";
import SettingsScreen from "@/screens/you/subscreens/SettingsScreen";

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
                name="Patterns"
                component={PatternsScreen}
            />

            <Stack.Screen
                name="Experiments"
                component={ExperimentsScreen}
            />

            <Stack.Screen
                name="Learnings"
                component={LearningsScreen}
            />

            <Stack.Screen
                name="YourData"
                component={YourDataScreen}
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
                component={PrivacyScreen}
            />

            <Stack.Screen
                name="HelpFeedback"
                component={HelpFeedbackScreen}
            />

            <Stack.Screen
                name="Settings"
                component={SettingsScreen}
            />
        </Stack.Navigator>
    );
}