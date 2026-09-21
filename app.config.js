// Expo app config. Dynamic so per-profile values follow the EAS build
// profile: development builds get development push, preview and
// production builds get production push. Local runs default to development.
const buildProfile = process.env.EAS_BUILD_PROFILE ?? "development";

module.exports = {
  name: "aks",
  slug: "aks",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "aks",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    deploymentTarget: "15.4",
    bundleIdentifier: "com.miyal.aks",
  },
  android: {
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#010100",
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    ],
    package: "com.miyal.aks",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-font",
      {
        fonts: [
          "./assets/fonts/satoshi_light.otf",
          "./assets/fonts/satoshi_regular.otf",
          "./assets/fonts/satoshi_medium.otf",
          "./assets/fonts/satoshi_bold.otf",
          "./assets/fonts/satoshi_black.otf",
        ],
      },
    ],
    "expo-video",
    "expo-navigation-bar",
    [
      "expo-audio",
      {
        microphonePermission: "Allow Aks to record what you want to reflect on.",
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
      },
    ],
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Allow Aks to understand where your day happens — like travel or time away from home — without storing precise coordinates.",
        locationAlwaysAndWhenInUsePermission: "Allow Aks to understand your day's context (travel, changes in routine) even when the app is closed. You can disconnect this anytime.",
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      "expo-calendar",
      {
        calendarPermission: "Allow Aks to see event times from your calendar so it can tell a changed plan apart from a dip in motivation.",
        remindersPermission: "Allow Aks to see due times of your reminders so planned actions count too.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Aks to choose a profile photo.",
        cameraPermission: false,
        microphonePermission: "Allow Aks to record what you want to reflect on.",
      },
    ],
    "expo-asset",
    "expo-sharing",
    [
      "expo-speech-recognition",
      {
        microphonePermission: "Allow Aks to record what you want to reflect on.",
        speechRecognitionPermission: "Allow Aks to turn your voice reflections into text on this device.",
      },
    ],
    [
      "onesignal-expo-plugin",
      {
        mode: buildProfile === "development" ? "development" : "production",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "0fa718ad-3aa5-4480-921b-64d3f8b5da86",
    },
  },
  owner: "miyal",
};
