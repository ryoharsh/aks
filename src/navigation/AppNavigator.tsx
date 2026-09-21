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
import SubscriptionScreen from "@/screens/you/setting/SubscriptionScreen";
import { AI_CONVERSATION_ENABLED } from "@/lib/aiConversation";
import { useAppFlow } from "@/providers/AppFlowProvider";
import { useSubscription } from "@/hooks/useSubscription";
import {
  isSubscriptionPending,
  requiresSubscriptionScreen,
} from "@/services/subscription/subscription.utils";
import { SUBSCRIPTION_DEV_BYPASS, SUBSCRIPTIONS_ENABLED } from "@/services/subscription/subscription.constants";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { state } = useAppFlow();
  // Single global access layer: trial active OR paid subscription active
  // (RevenueCat `premium` entitlement) → main app; otherwise the
  // Subscription screen. No per-screen checks anywhere else. Development
  // builds bypass the gate entirely (SUBSCRIPTION_DEV_BYPASS).
  const { state: subscription } = useSubscription();
  const subscriptionPending =
    state === "main" && isSubscriptionPending(subscription);
  const subscriptionLocked =
    state === "main" &&
    SUBSCRIPTIONS_ENABLED &&
    !SUBSCRIPTION_DEV_BYPASS &&
    !subscriptionPending &&
    requiresSubscriptionScreen(subscription);
  const effectiveState = subscriptionPending
    ? "loading"
    : subscriptionLocked
      ? "SubscriptionRequired"
      : state;

  return (
    <Stack.Navigator
      key={`${state}:${subscriptionLocked ? "locked" : "open"}`}
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      {effectiveState === "loading" ? <Stack.Screen name="Splash" component={SplashScreen} /> : null}
      {effectiveState === "onboarding" ? <Stack.Screen name="Onboarding" component={OnboardingScreen} /> : null}
      {effectiveState === "auth" ? <Stack.Screen name="Auth" component={AuthNavigator} /> : null}
      {effectiveState === "legal" ? <Stack.Screen name="LegalAcceptance" component={LegalAcceptanceScreen} /> : null}
      {effectiveState === "SubscriptionRequired" ? (
        <Stack.Screen
          name="SubscriptionRequired"
          component={SubscriptionScreen}
        />
      ) : null}
      {effectiveState === "main" ? (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          {AI_CONVERSATION_ENABLED ? (
            <Stack.Screen
              name="AiConversation"
              component={AiConversationScreen}
              options={{ animation: "slide_from_bottom" }}
            />
          ) : null}
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
