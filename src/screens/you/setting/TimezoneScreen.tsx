import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import ProfilePreferenceScreen from "@/components/setting/ProfilePreferenceScreen";

import type { SettingsStackParamList } from "@/navigation/routes";

type Props = NativeStackScreenProps<SettingsStackParamList, "Timezone">;

type TimezoneOption = {
    value: string;
    label: string;
};

function getTimezoneLabel(timeZone: string): TimezoneOption {
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
    const deviceTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone;

    const timezoneOptions = getTimezoneOptions();

    const deviceTimezoneOption =
        timezoneOptions.find(
            (option) => option.value === deviceTimezone,
        ) ?? getTimezoneLabel(deviceTimezone);

    return (
        <ProfilePreferenceScreen
            headerTitle="Timezone"
            eyebrow="PREFERENCES"
            title="Your local time."
            description="Aks uses the timezone reported by your device. A persistent choice will only be added when scheduling requires it."
            options={timezoneOptions.map((option) => option.label)}
            selections={[deviceTimezoneOption.label]}
            onSave={async () => { }}
            onBack={() => navigation.goBack()}
        />
    );
}