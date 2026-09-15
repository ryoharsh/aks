export type ConversationMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
};

export type Conversation = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    group: "Today" | "This week" | "Earlier";
    messages: ConversationMessage[];
};

export const mockConversations: Conversation[] = [
    {
        id: "morning-focus",
        title: "How my mornings affect focus",
        createdAt: "2026-09-15T08:20:00.000Z",
        updatedAt: "2026-09-15T08:34:00.000Z",
        group: "Today",
        messages: [
            {
                id: "morning-focus-1",
                role: "user",
                content: "I seem to focus better when I don't check messages first thing in the morning.",
                createdAt: "8:20 AM",
            },
            {
                id: "morning-focus-2",
                role: "assistant",
                content: "That sounds worth observing. What feels different on mornings when you delay checking messages?",
                createdAt: "8:21 AM",
            },
            {
                id: "morning-focus-3",
                role: "user",
                content: "My thoughts feel quieter and I can start one task without jumping between things.",
                createdAt: "8:24 AM",
            },
        ],
    },
    {
        id: "afternoon-energy",
        title: "Why do I lose energy after lunch?",
        createdAt: "2026-09-15T13:40:00.000Z",
        updatedAt: "2026-09-15T13:52:00.000Z",
        group: "Today",
        messages: [
            {
                id: "afternoon-energy-1",
                role: "user",
                content: "My energy drops almost every afternoon after lunch.",
                createdAt: "1:40 PM",
            },
            {
                id: "afternoon-energy-2",
                role: "assistant",
                content: "We can explore the context without assuming one cause. Does the drop change with sleep, meal size, movement, or workload?",
                createdAt: "1:41 PM",
            },
        ],
    },
    {
        id: "sleep-pattern",
        title: "My sleep pattern",
        createdAt: "2026-09-12T21:05:00.000Z",
        updatedAt: "2026-09-12T21:18:00.000Z",
        group: "This week",
        messages: [
            {
                id: "sleep-pattern-1",
                role: "user",
                content: "I sleep later on days when I work into the evening.",
                createdAt: "Friday, 9:05 PM",
            },
            {
                id: "sleep-pattern-2",
                role: "assistant",
                content: "Would you like to track evening work and bedtime for a week to see whether that relationship stays consistent?",
                createdAt: "Friday, 9:06 PM",
            },
        ],
    },
    {
        id: "difficult-tasks",
        title: "I keep delaying difficult tasks",
        createdAt: "2026-09-10T10:15:00.000Z",
        updatedAt: "2026-09-10T10:31:00.000Z",
        group: "This week",
        messages: [
            {
                id: "difficult-tasks-1",
                role: "user",
                content: "I keep postponing tasks when I don't know how long they will take.",
                createdAt: "Wednesday, 10:15 AM",
            },
            {
                id: "difficult-tasks-2",
                role: "assistant",
                content: "Uncertainty may be creating friction. A small experiment could be defining only the first ten-minute step.",
                createdAt: "Wednesday, 10:16 AM",
            },
        ],
    },
    {
        id: "morning-routine",
        title: "Should I change my morning routine?",
        createdAt: "2026-09-03T07:50:00.000Z",
        updatedAt: "2026-09-03T08:08:00.000Z",
        group: "Earlier",
        messages: [
            {
                id: "morning-routine-1",
                role: "user",
                content: "My morning routine feels rushed, but I don't want to make it complicated.",
                createdAt: "September 3, 7:50 AM",
            },
            {
                id: "morning-routine-2",
                role: "assistant",
                content: "You could begin with one small change and observe whether it makes the morning feel calmer.",
                createdAt: "September 3, 7:51 AM",
            },
        ],
    },
];
