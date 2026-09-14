import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { RootStackParamList } from "./routes";

import SplashScreen from "@/screens/SplashScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import LegalAcceptanceScreen from "@/screens/legal/LegalAcceptanceScreen";
import TermsScreen from "@/screens/legal/TermsScreen";
import PrivacyPolicyScreen from "@/screens/legal/PrivacyPolicyScreen";

import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      {/* Entry */}
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
      />

      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Authentication */}
      <Stack.Screen
        name="Auth"
        component={AuthNavigator}
      />

      {/* Legal */}
      <Stack.Screen
        name="LegalAcceptance"
        component={LegalAcceptanceScreen}
      />

      {/* Authenticated application */}
      <Stack.Screen
        name="Main"
        component={MainNavigator}
      />

      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack.Navigator>
  );
}