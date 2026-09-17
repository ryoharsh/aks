export type MirrorContext = {
    currentMessage: string;
    conversation: { title: string };
    recentMessages: Array<{ role: "user" | "assistant" | "system"; content: string; createdAt: string }>;
    recentSignals: Array<{ signalType: string; value: unknown; observedAt: string }>;
    activeMemories: Array<{ content: string; memoryType: string; lastObservedAt: string }>;
    preferences: { whatExploring: string[]; whatToNotice: string[] };
};

export function buildMirrorContext(input: MirrorContext): MirrorContext {
    return {
        currentMessage: input.currentMessage.slice(0, 12000),
        conversation: input.conversation,
        recentMessages: input.recentMessages.slice(-12).map((message) => ({
            ...message,
            content: message.content.slice(0, 2000),
        })),
        recentSignals: input.recentSignals.slice(0, 8),
        activeMemories: input.activeMemories.slice(0, 6).map((memory) => ({ ...memory, content: memory.content.slice(0, 500) })),
        preferences: {
            whatExploring: input.preferences.whatExploring.slice(0, 5).map((value) => value.slice(0, 100)),
            whatToNotice: input.preferences.whatToNotice.slice(0, 5).map((value) => value.slice(0, 100)),
        },
    };
}
