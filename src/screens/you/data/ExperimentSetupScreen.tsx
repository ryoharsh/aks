import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { usePattern } from "@/hooks/usePatterns";
import type { YourDataStackParamList } from "@/navigation/routes";
import { experimentsService } from "@/services/experiments.service";

type Props = NativeStackScreenProps<YourDataStackParamList, "ExperimentSetup">;

export default function ExperimentSetupScreen({ navigation, route }: Props) {
    const pattern = usePattern(route.params.patternId);
    const iconColor = useResolveClassNames("text-text-medium").color;
    const placeholderColor = useResolveClassNames("text-text-disabled").color as string;
    const [title, setTitle] = useState("");
    const [hypothesis, setHypothesis] = useState("");
    const [description, setDescription] = useState("");
    const [durationDays, setDurationDays] = useState(5);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!pattern.pattern || title) return;
        setTitle(`Test: ${pattern.pattern.title}`.slice(0, 120));
        setHypothesis(`A small change may affect what you observe in this pattern.`);
        setDescription("Choose one small, reversible change. Record whether the result felt easier, the same, or harder each time.");
    }, [pattern.pattern, title]);

    const create = async () => {
        setSaving(true); setError(null);
        try {
            const experiment = await experimentsService.createExperiment({ patternId: route.params.patternId, title, hypothesis, description, durationDays });
            navigation.replace("ExperimentDetail", { experimentId: experiment.id });
        } catch { setError("We couldn't create this experiment. Check the details and try again."); }
        finally { setSaving(false); }
    };

    return <View className="flex-1 bg-background"><View className="h-16 flex-row items-center px-5"><IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel="Back"><HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} /></IconButton><AppText variant="title" className="text-text-high">Set up experiment</AppText></View><ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
        {pattern.loading ? <ActivityIndicator className="mt-12" color={iconColor} /> : pattern.pattern ? <>
            <AppText variant="caption" className="mt-5 tracking-[1.5px] text-text-low">PATTERN BEING TESTED</AppText><AppText variant="title" className="mt-2 text-text-high">{pattern.pattern.title}</AppText>
            <Field label="TITLE" value={title} onChangeText={setTitle} placeholder="Short experiment title" placeholderColor={placeholderColor} />
            <Field label="HYPOTHESIS" value={hypothesis} onChangeText={setHypothesis} placeholder="A small change may..." placeholderColor={placeholderColor} multiline />
            <Field label="WHAT TO TRY AND OBSERVE" value={description} onChangeText={setDescription} placeholder="Describe one small change and what you will record." placeholderColor={placeholderColor} multiline />
            <AppText variant="caption" className="mb-3 mt-7 tracking-[1.5px] text-text-low">DURATION</AppText><View className="flex-row gap-2">{[3, 5, 7, 14].map((days) => <Button key={days} variant={durationDays === days ? "primary" : "secondary"} onPress={() => setDurationDays(days)} className="min-h-11 flex-1 px-2" accessibilityLabel={`${days} day duration`}><AppText variant="button" className={durationDays === days ? "text-primary-foreground" : "text-text-high"}>{days}d</AppText></Button>)}</View>
            {error ? <AppText className="mt-5 text-red-600">{error}</AppText> : null}<Button onPress={() => void create()} loading={saving} className="mt-8" accessibilityLabel="Create experiment draft"><AppText variant="button" className="text-primary-foreground">Create draft</AppText></Button>
        </> : <AppText className="mt-10 text-text-low">This pattern is unavailable.</AppText>}
    </ScrollView></View>;
}

function Field({ label, placeholderColor, ...props }: React.ComponentProps<typeof TextInput> & { label: string; placeholderColor: string }) {
    return <View className="mt-7"><AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{label}</AppText><TextInput {...props} accessibilityLabel={label} placeholderTextColor={placeholderColor} className="min-h-14 rounded-2xl border border-border bg-surface px-4 py-3 text-base text-text-high" textAlignVertical={props.multiline ? "top" : "center"} /></View>;
}
