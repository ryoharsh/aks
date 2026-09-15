import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  LegalAcceptance: undefined;
  Main: undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type YouStackParamList = {
    YouHome: undefined;
  YourData: NavigatorScreenParams<YourDataStackParamList> | undefined;
    Notifications: undefined;
    Appearance: undefined;
    Privacy: undefined;
    HelpFeedback: undefined;
    Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

  export type SettingsStackParamList = {
    SettingsHome: undefined;
    Profile: undefined;
    Exploring: undefined;
    NoticeAreas: undefined;
    Timezone: undefined;
    Language: undefined;
    Subscription: undefined;
    About: undefined;
  };

  export type YourDataStackParamList = {
    YourDataHome: undefined;
    Conversations: undefined;
    ConversationDetail: { conversationId: string };
    Reflections: undefined;
    CheckIns: undefined;
    Patterns: undefined;
    Experiments: undefined;
    Learnings: undefined;
  };

  export type HelpFeedbackStackParamList = {
    HelpFeedbackHome: undefined;
    FAQ: undefined;
    ReportProblem: undefined;
    SendFeedback: undefined;
  };