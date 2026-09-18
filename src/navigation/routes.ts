import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  LegalAcceptance: undefined;
  Main: undefined;
  AiConversation: { conversationId?: string } | undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type YouStackParamList = {
  YouHome: undefined;
  YourData: (NavigatorScreenParams<YourDataStackParamList> & { returnToTimeline?: boolean }) | undefined;
  Notifications: undefined;
  Appearance: undefined;
  Privacy: NavigatorScreenParams<PrivacyStackParamList> | undefined;
  HelpFeedback: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  Account: undefined;
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
  Memories: undefined;
  Patterns: undefined;
  MemoryDetail: { memoryId: string };
  PatternDetail: { patternId: string };
  Experiments: undefined;
  ExperimentSetup: { patternId: string };
  ExperimentDetail: { experimentId: string };
  Learnings: undefined;
  LearningDetail: { learningId: string };
  Insights: undefined;
  InsightDetail: { insightId: string };
};

export type HelpFeedbackStackParamList = {
  HelpFeedbackHome: undefined;
  FAQ: undefined;
  ReportProblem: undefined;
  SendFeedback: undefined;
};

export type PrivacyStackParamList = {
  PrivacyHome: undefined;
  DataUsage: undefined;
  DataAccess: undefined;
  ExportData: undefined;
  DeleteData: undefined;
};
