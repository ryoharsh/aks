import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from '@/theme/ThemeProvider';
import { exchangeAuthCallback } from '@/lib/auth';
import './globals.css';

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

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      void exchangeAuthCallback(url);
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void exchangeAuthCallback(url);
      }
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ThemeProvider>
  );
}