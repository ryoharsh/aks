import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import FeedbackFormScreen from "@/components/help/FeedbackFormScreen";
import type { HelpFeedbackStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<
    HelpFeedbackStackParamList,
    "SendFeedback"
>;

export default function SendFeedbackScreen({ navigation }: Props) {
    return (
        <FeedbackFormScreen
            headerTitle={copy.sendFeedback.header}
            title={copy.sendFeedback.title}
            description={copy.sendFeedback.description}
            optionLabel={copy.sendFeedback.optionLabel}
            optionHint={copy.sendFeedback.optionHint}
            options={copy.sendFeedback.options}
            initialOption={copy.sendFeedback.initialOption}
            messageLabel={copy.sendFeedback.messageLabel}
            messagePlaceholder={copy.sendFeedback.messagePlaceholder}
            messageHint={copy.sendFeedback.messageHint}
            emailHint={copy.sendFeedback.emailHint}
            noteTitle={copy.sendFeedback.noteTitle}
            noteDescription={copy.sendFeedback.noteBody}
            submitLabel={copy.sendFeedback.submit}
            leaveMessage={copy.sendFeedback.leaveMessage}
            onBack={() => navigation.goBack()}
        />
    );
}
