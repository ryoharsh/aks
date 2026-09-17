import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { RootStackParamList } from "./routes";

import SplashScreen from "@/screens/SplashScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import LegalAcceptanceScreen from "@/screens/legal/LegalAcceptanceScreen";
import TermsScreen from "@/screens/legal/TermsScreen";
import PrivacyPolicyScreen from "@/screens/legal/PrivacyPolicyScreen";
import AiConversationScreen from "@/screens/mirror/AiConversationScreen";

import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import { useAppFlow } from "@/providers/AppFlowProvider";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { state } = useAppFlow();

  return (
    <Stack.Navigator
      key={state}
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      {state === "loading" ? <Stack.Screen name="Splash" component={SplashScreen} /> : null}
      {state === "onboarding" ? <Stack.Screen name="Onboarding" component={OnboardingScreen} /> : null}
      {state === "auth" ? <Stack.Screen name="Auth" component={AuthNavigator} /> : null}
      {state === "legal" ? <Stack.Screen name="LegalAcceptance" component={LegalAcceptanceScreen} /> : null}
      {state === "main" ? (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          <Stack.Screen
            name="AiConversation"
            component={AiConversationScreen}
            options={{ animation: "slide_from_bottom" }}
          />
        </>
      ) : null}

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
