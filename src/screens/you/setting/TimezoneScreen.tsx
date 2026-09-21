import { useMemo } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";
import { usePreferences } from "@/providers/PreferencesProvider";
import { copy } from "@/constants/copy";

import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Timezone">;

type TimezoneOption = {
    value: string;
    label: string;
};

export function getTimezoneLabel(timeZone: string): TimezoneOption {
    const date = new Date();

    const shortName = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "short",
    })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value;

    const longName = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "long",
    })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value;

    return {
        value: timeZone,
        label: `${shortName ?? timeZone} · ${longName ?? timeZone}`,
    };
}

function getTimezoneOptions(): TimezoneOption[] {
    const supportedTimezones =
        typeof Intl.supportedValuesOf === "function"
            ? Intl.supportedValuesOf("timeZone")
            : [
                "UTC",
                "America/New_York",
                "America/Los_Angeles",
                "Europe/London",
                "Asia/Kolkata",
            ];

    return supportedTimezones
        .map(getTimezoneLabel)
        .sort((a, b) => a.label.localeCompare(b.label));
}

export default function TimezoneScreen({ navigation }: Props) {
    const { preferences, updatePreferences } = usePreferences();
    const deviceTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone;

    const timezoneOptions = useMemo(getTimezoneOptions, []);
    // Explicit choice wins; otherwise follow the device-reported zone.
    const activeTimezone = preferences.timezone ?? deviceTimezone;

    const activeTimezoneOption =
        timezoneOptions.find(
            (option) => option.value === activeTimezone,
        ) ?? getTimezoneLabel(activeTimezone);

    const saveTimezone = async (selections: string[]) => {
        const picked = timezoneOptions.find((option) => option.label === selections[0]);
        await updatePreferences({ timezone: picked?.value ?? activeTimezone });
    };

    return (
        <ProfilePreferenceScreen
            headerTitle={copy.timezone.header}
            eyebrow={copy.timezone.eyebrow}
            title={copy.timezone.title}
            description={copy.timezone.description}
            options={timezoneOptions.map((option) => option.label)}
            selections={[activeTimezoneOption.label]}
            onSave={saveTimezone}
            onBack={() => navigation.goBack()}
        />
    );
}
