import { useCallback, useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    BubbleChatIcon,
    Calendar03Icon,
    Cancel01Icon,
    CheckListIcon,
    GithubIcon,
    GoogleIcon,
    Link01Icon,
    LinkSquare01Icon,
    Mail01Icon,
    SlackIcon,
    SmartPhone01Icon,
    Task01Icon,
} from "@hugeicons/core-free-icons";
import { useResolveClassNames } from "uniwind";

import AppText from "@/components/ui/Text";
import IconButton from "@/components/ui/IconButton";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/date";
import { contextService } from "@/services/context/context.service";
import { oauthSourceLinks } from "@/services/context/oauth";
import { SOURCE_DEFINITIONS, type ContextSourceType, type SourceState } from "@/services/context/types";
import type { YourDataStackParamList } from "@/navigation/routes";
import { copy } from "@/constants/copy";

type Props = NativeStackScreenProps<YourDataStackParamList, "ConnectedSources">;

type SourceUi = {
    sourceType: ContextSourceType;
    name: string;
    state: SourceState;
    statusLabel: string;
    lastSyncedAt: string | null;
    definition: (typeof SOURCE_DEFINITIONS)[ContextSourceType];
};

type GroupUi = {
    key: string;
    label: string;
    sources: SourceUi[];
};

const sourceIcons: Partial<Record<ContextSourceType, IconSvgElement>> = {
    location: BubbleChatIcon,
    calendar: Calendar03Icon,
    google_calendar: GoogleIcon,
    apple_calendar: Calendar03Icon,
    reminders: Task01Icon,
    google_tasks: CheckListIcon,
    apple_reminders: CheckListIcon,
    notion: LinkSquare01Icon,
    todoist: CheckListIcon,
    github: GithubIcon,
    slack: SlackIcon,
    email: Mail01Icon,
    screen_time: SmartPhone01Icon,
};

function statusCopy(state: SourceState): string {
    switch (state) {
        case "connected": return copy.connectedSources.status.connected;
        case "permission_required": return copy.connectedSources.status.permissionRequired;
        case "not_connected": return copy.connectedSources.status.notConnected;
        case "not_available": return copy.connectedSources.status.notAvailable;
        case "revoked": return copy.connectedSources.status.revoked;
        case "temporarily_unavailable": return copy.connectedSources.status.temporarilyUnavailable;
        case "error": return copy.connectedSources.status.error;
        default: return copy.connectedSources.status.notConnected;
    }
}

/** Only reports a sync time the registry actually recorded. */
function syncCopy(lastSyncedAt: string | null): string {
    const synced = formatRelativeTime(lastSyncedAt);
    return synced ? copy.connectedSources.syncedAgo(synced) : copy.connectedSources.notSynced;
}

function SectionLabel({ children }: { children: string }) {
    return <AppText variant="caption" className="mb-3 tracking-[1.5px] text-text-low">{children}</AppText>;
}

export default function ConnectedSourcesScreen({ navigation }: Props) {
    const [groups, setGroups] = useState<GroupUi[] | null>(null);
    const [busy, setBusy] = useState<ContextSourceType | null>(null);
    const [expanded, setExpanded] = useState<ContextSourceType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const iconColor = useResolveClassNames("text-text-medium").color;

    const load = useCallback(async () => {
        setError(null);
        try {
            const grouped = await contextService.getGroupedStatuses();
            // Removed sources are deleted, not shown as unavailable — skip any empty group.
            setGroups(grouped.filter((group) => group.sources.length > 0).map((group) => ({
                key: group.key,
                label: group.label,
                sources: group.sources.map((source) => ({
                    sourceType: source.sourceType,
                    name: SOURCE_DEFINITIONS[source.sourceType].name,
                    state: source.state,
                    statusLabel: statusCopy(source.state),
                    lastSyncedAt: source.lastSyncedAt,
                    definition: SOURCE_DEFINITIONS[source.sourceType],
                })),
            })));
        } catch {
            setError(copy.connectedSources.loadError);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    // The OAuth callback lands while this screen is open; reflect it immediately
    // instead of waiting for the next manual visit.
    useEffect(() => oauthSourceLinks.addListener(() => { void load(); }), [load]);

    const connect = async (sourceType: ContextSourceType) => {
        setBusy(sourceType);
        try {
            const definition = SOURCE_DEFINITIONS[sourceType];
            if (definition.connection === "oauth") {
                const started = await oauthSourceLinks.connect(sourceType);
                if (!started) setError(copy.connectedSources.notices.providerNotConfigured);
            } else {
                await contextService.connect(sourceType);
            }
            await load();
        } catch {
            setError(copy.connectedSources.notices.unableToConnect);
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async (sourceType: ContextSourceType) => {
        setBusy(sourceType);
        try {
            if (SOURCE_DEFINITIONS[sourceType].connection === "oauth") {
                await oauthSourceLinks.disconnect(sourceType);
            }
            await contextService.disconnect(sourceType);
            await load();
        } finally {
            setBusy(null);
        }
    };

    const deleteData = async (sourceType: ContextSourceType) => {
        setBusy(sourceType);
        try {
            await contextService.deleteSourceData(sourceType);
            await load();
        } finally {
            setBusy(null);
        }
    };

    const renderSource = (source: SourceUi, isLast: boolean) => {
        const definition = SOURCE_DEFINITIONS[source.sourceType];
        const isExpanded = expanded === source.sourceType;
        return (
            <View key={source.sourceType} className={cn("px-5 py-5", !isLast && "border-b border-border")}>
                <Pressable
                    onPress={() => setExpanded(isExpanded ? null : source.sourceType)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isExpanded }}
                    className="flex-row items-center"
                >
                    <View className="mr-4 size-10 items-center justify-center rounded-2xl bg-background">
                        <HugeiconsIcon icon={sourceIcons[source.sourceType] ?? Link01Icon} size={19} color={iconColor} />
                    </View>
                    <View className="flex-1 pr-3">
                        <AppText className="text-text-medium">{definition.name}</AppText>
                        <AppText variant="caption" className="mt-1 text-text-low">
                            {source.statusLabel}
                            {source.state === "connected" ? ` · ${syncCopy(source.lastSyncedAt)}` : ""}
                        </AppText>
                    </View>
                    <HugeiconsIcon icon={isExpanded ? Cancel01Icon : ArrowRight01Icon} size={17} color={iconColor} style={{ marginLeft: 8 }} />
                </Pressable>

                {isExpanded ? (
                    <View className="mt-4 rounded-3xl bg-background p-4">
                        <AppText variant="caption" className="tracking-[1.2px] text-text-low">{copy.connectedSources.whyHelps}</AppText>
                        <AppText className="mt-2 leading-6 text-text-high">{definition.purpose}</AppText>

                        <AppText variant="caption" className="mt-4 tracking-[1.2px] text-text-low">{copy.connectedSources.whatReceives}</AppText>
                        <AppText className="mt-2 leading-6 text-text-high">{definition.whatAksReceives}</AppText>

                        <AppText variant="caption" className="mt-4 tracking-[1.2px] text-text-low">{copy.connectedSources.whatStored}</AppText>
                        <AppText className="mt-2 leading-6 text-text-high">{definition.whatIsStored}</AppText>

                        <AppText variant="caption" className="mt-4 tracking-[1.2px] text-text-low">{copy.connectedSources.howToStop}</AppText>
                        <AppText className="mt-2 leading-6 text-text-high">{definition.howToStop}</AppText>

                        {definition.batteryNote ? (
                            <>
                                <AppText variant="caption" className="mt-4 tracking-[1.2px] text-text-low">{copy.connectedSources.goodToKnow}</AppText>
                                <AppText className="mt-2 leading-6 text-text-high">{definition.batteryNote}</AppText>
                            </>
                        ) : null}

                        <View className="mt-5 flex-row flex-wrap gap-3">
                            {source.state === "connected" ? (
                                <>
                                    <Button variant="secondary" onPress={() => void disconnect(source.sourceType)} disabled={busy === source.sourceType}>
                                        <AppText variant="button" className="text-text-high">{copy.connectedSources.disconnect}</AppText>
                                    </Button>
                                    <Button variant="secondary" onPress={() => void deleteData(source.sourceType)} disabled={busy === source.sourceType}>
                                        <AppText variant="button" className="text-text-high">{copy.connectedSources.deleteData}</AppText>
                                    </Button>
                                </>
                            ) : source.state === "permission_required" ? (
                                <Button onPress={() => void connect(source.sourceType)} disabled={busy === source.sourceType}>
                                    <AppText variant="button" className="text-primary-foreground">{copy.connectedSources.allow}</AppText>
                                </Button>
                            ) : source.state === "not_connected" ? (
                                <Button onPress={() => void connect(source.sourceType)} disabled={busy === source.sourceType}>
                                    <AppText variant="button" className="text-primary-foreground">{copy.connectedSources.connect}</AppText>
                                </Button>
                            ) : source.state === "revoked" ? (
                                <Button onPress={() => void connect(source.sourceType)} disabled={busy === source.sourceType}>
                                    <AppText variant="button" className="text-primary-foreground">{copy.connectedSources.reconnect}</AppText>
                                </Button>
                            ) : null}
                        </View>
                    </View>
                ) : null}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-background">
            <Animated.View entering={FadeInUp.duration(400)} className="h-16 flex-row items-center px-5">
                <IconButton onPress={() => navigation.goBack()} className="mr-3" accessibilityLabel={copy.common.back}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={iconColor} />
                </IconButton>
                <AppText variant="title" className="text-text-high">{copy.connectedSources.header}</AppText>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-24">
                <Animated.View entering={FadeInDown.duration(500).delay(80)} className="mt-5">
                    <SectionLabel>{copy.connectedSources.eyebrow}</SectionLabel>
                    <AppText variant="display" className="text-text-high">{copy.connectedSources.title}</AppText>
                    <AppText className="mt-3 leading-6 text-text-low">
                        {copy.connectedSources.description}
                    </AppText>
                </Animated.View>

                {error ? (
                    <View className="mt-6 rounded-[28px] border border-border bg-surface p-5">
                        <AppText className="text-text-low">{error}</AppText>
                    </View>
                ) : null}

                {groups === null ? (
                    <View className="items-center py-10"><ActivityIndicator color={iconColor} accessibilityLabel="Loading sources" /></View>
                ) : (
                    <Animated.View entering={FadeInUp.duration(450).delay(150)} className="mt-9">
                        {groups.map((group, groupIndex) => (
                            <View key={group.key} className={cn(groupIndex > 0 && "mt-9")}>
                                <SectionLabel>{group.label}</SectionLabel>
                                <View className="overflow-hidden rounded-[28px] border border-border bg-surface">
                                    {group.sources.map((source, index) => renderSource(source, index === group.sources.length - 1))}
                                </View>
                            </View>
                        ))}
                    </Animated.View>
                )}

                <Animated.View entering={FadeInUp.duration(450).delay(220)} className="mt-9 rounded-[28px] border border-border bg-surface p-5">
                    <SectionLabel>{copy.connectedSources.choiceSection}</SectionLabel>
                    <AppText className="leading-6 text-text-low">
                        {copy.connectedSources.choiceBody}
                    </AppText>
                </Animated.View>
            </ScrollView>
        </View>
    );
}
