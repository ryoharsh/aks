import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from '@/theme/ThemeProvider';
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