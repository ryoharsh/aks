import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import FeedbackFormScreen from "@/components/help/FeedbackFormScreen";
import type { HelpFeedbackStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<
    HelpFeedbackStackParamList,
    "SendFeedback"
>;

const FEEDBACK_TYPES = [
    "Idea",
    "Feature request",
    "General feedback",
    "Something I liked",
] as const;

export default function SendFeedbackScreen({ navigation }: Props) {
    return (
        <FeedbackFormScreen
            headerTitle="Send feedback"
            title="Help shape Aks."
            description="Share an idea, request a feature, or tell us what is already working well."
            optionLabel="FEEDBACK TYPE"
            optionHint="Choose one"
            options={FEEDBACK_TYPES}
            initialOption="General feedback"
            messageLabel="YOUR FEEDBACK"
            messagePlaceholder="What would make Aks more useful to you?"
            messageHint="Ideas, suggestions, or things you enjoyed are all welcome."
            emailHint="Leave your email only if you'd like a response."
            noteTitle="Your feedback matters."
            noteDescription="What you share helps us decide what Aks should become next."
            submitLabel="Send feedback"
            leaveMessage="You can leave this page without sending anything."
            onBack={() => navigation.goBack()}
        />
    );
}
