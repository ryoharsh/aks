const immediateRiskPatterns = [
    /\bkill myself\b/i,
    /\bend my life\b/i,
    /\bdon't want to live\b/i,
    /\bdo not want to live\b/i,
    /\bsuicid(?:e|al)\b/i,
    /\bhurt myself\b/i,
    /\boverdose(?: tonight| now)?\b/i,
    /\bjump off (?:a|the) (?:bridge|building)\b/i,
    /\bbetter off dead\b/i,
    /\bplan(?:ning)? to die\b/i,
    /\bcan't go on\b/i,
];

export function requiresCrisisResponse(message: string) {
    return immediateRiskPatterns.some((pattern) => pattern.test(message));
}

export const crisisResponse = "I'm really sorry you're dealing with this. If you might act on these thoughts now, contact your local emergency services or crisis line immediately, and reach out to someone you trust who can stay with you. Aks can't provide emergency support.";
