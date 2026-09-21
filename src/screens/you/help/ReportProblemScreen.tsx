import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import FeedbackFormScreen from "@/components/help/FeedbackFormScreen";
import type { HelpFeedbackStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<
    HelpFeedbackStackParamList,
    "ReportProblem"
>;

export default function ReportProblemScreen({ navigation }: Props) {
    return (
        <FeedbackFormScreen
            headerTitle={copy.reportProblem.header}
            title={copy.reportProblem.title}
            description={copy.reportProblem.description}
            optionLabel={copy.reportProblem.optionLabel}
            optionHint={copy.reportProblem.optionHint}
            options={copy.reportProblem.options}
            messageLabel={copy.reportProblem.messageLabel}
            messagePlaceholder={copy.reportProblem.messagePlaceholder}
            messageHint={copy.reportProblem.messageHint}
            emailHint={copy.reportProblem.emailHint}
            noteTitle={copy.reportProblem.noteTitle}
            noteDescription={copy.reportProblem.noteBody}
            submitLabel={copy.reportProblem.submit}
            leaveMessage={copy.reportProblem.leaveMessage}
            requireOption
            onBack={() => navigation.goBack()}
        />
    );
}
