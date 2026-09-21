import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { AppFlowProvider } from '@/providers/AppFlowProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { LanguageProvider, useLanguage } from '@/providers/LanguageProvider';
import { SubscriptionProvider } from '@/providers/SubscriptionProvider';
import { BottomSheetProvider } from '@/components/ui/BottomSheetProvider';
import { useNotificationLifecycle } from '@/hooks/useNotificationLifecycle';
import { useContextSync } from '@/hooks/useContextSync';
import ThemePreferenceSync from '@/components/ThemePreferenceSync';
import ThemedSystemBars from '@/theme/ThemedSystemBars';
import { useUniwind } from 'uniwind';
import { clearRealtimeAudioHardwareCache } from '@/services/realtime/audio/realtime-audio';
import './globals.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    "Satoshi-Light": require("./assets/fonts/satoshi_light.otf"),
    "Satoshi-Regular": require("./assets/fonts/satoshi_regular.otf"),
    "Satoshi-Medium": require("./assets/fonts/satoshi_medium.otf"),
    "Satoshi-Bold": require("./assets/fonts/satoshi_bold.otf"),
    "Satoshi-Black": require("./assets/fonts/satoshi_black.otf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <BottomSheetProvider>
        <ThemeProvider>
          <AuthProvider>
            <PreferencesProvider>
              <LanguageProvider>
                <AppServices />
              </LanguageProvider>
            </PreferencesProvider>
          </AuthProvider>
        </ThemeProvider>
      </BottomSheetProvider>
    </SafeAreaProvider>
  );
}

function AppServices() {
  useNotificationLifecycle();
  useContextSync();

  useEffect(() => {
    // A development build that registers AksRealtimeAudio may be installed
    // while the JS bundle stays alive; re-probe support each time the app
    // returns to the foreground so availability tracks the native runtime.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") clearRealtimeAudioHardwareCache();
    });
    return () => subscription.remove();
  }, []);

  return (
    <SubscriptionProvider>
      <ThemePreferenceSync />
      <ThemedSystemBars />
      <AppFlowProvider>
        <ThemedNavigationContainer />
      </AppFlowProvider>
    </SubscriptionProvider>
  );
}

function ThemedNavigationContainer() {
  const { theme } = useUniwind();
  return (
    <NavigationContainer theme={theme === "dark" ? DarkTheme : DefaultTheme}>
      <LocalizedNavigator />
    </NavigationContainer>
  );
}

function LocalizedNavigator() {
  useLanguage();
  return <AppNavigator />;
}