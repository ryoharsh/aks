import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import FeedbackFormScreen from "@/components/help/FeedbackFormScreen";
import type { HelpFeedbackStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<
    HelpFeedbackStackParamList,
    "ReportProblem"
>;

const CATEGORIES = [
    "Something isn't working",
    "App crashed",
    "Incorrect insight",
    "Data issue",
    "Notification issue",
    "Other",
] as const;

export default function ReportProblemScreen({ navigation }: Props) {
    return (
        <FeedbackFormScreen
            headerTitle="Report a problem"
            title="What went wrong?"
            description="Tell us what happened. The more context you share, the easier it is for us to understand and fix it."
            optionLabel="PROBLEM CATEGORY"
            optionHint="Choose one"
            options={CATEGORIES}
            messageLabel="WHAT HAPPENED?"
            messagePlaceholder="Describe what you expected and what happened instead..."
            messageHint="Please include any steps that caused the problem."
            emailHint="Add an email only if you'd like us to follow up."
            noteTitle="Thank you for helping improve Aks."
            noteDescription="Your report helps us make Aks more reliable for everyone."
            submitLabel="Submit report"
            leaveMessage="You can leave this page without submitting."
            requireOption
            onBack={() => navigation.goBack()}
        />
    );
}
