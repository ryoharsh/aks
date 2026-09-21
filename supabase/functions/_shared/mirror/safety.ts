/**
 * Immediate self-harm risk detection.
 *
 * This is a deterministic pre-filter, not the only safety net: the model also
 * classifies risk on every turn, and its verdict replaces the reply when risk is
 * imminent. A pre-filter earns its place because it never depends on a provider
 * being reachable or a model behaving, so it has to cover the languages the
 * product actually ships rather than only English.
 *
 * The two failure modes are not symmetric. A message this misses still reaches
 * the model, which can still catch it. A message it wrongly flags shows someone a
 * controlled emergency response where a reply belonged — alarming, and corrosive
 * to trust. So each pattern requires a specific intent construction: never a bare
 * word that also carries an ordinary meaning in that language.
 *
 * Adding a pattern: write the phrase as a person would actually type it, in the
 * language's own script, and check it against an ordinary-stress sentence in the
 * same language before adding it. Romanized Hindi and Urdu are covered only
 * partially — see the transliteration group at the end.
 */

/**
 * Normalize only where the *spelling or the encoding* genuinely varies, so one
 * pattern per phrase covers every form a person might actually type. Anything
 * more would start erasing distinctions the languages care about.
 *
 * Arabic script: routinely written without its harakat, the same word can use any
 * of the alef forms (ا أ إ آ), and it may carry a decorative tatweel. All three
 * are spelling variations of one word, so collapsing them is safe and removes a
 * whole class of near-miss patterns.
 *
 * Devanagari: a nukta letter is one codepoint (U+095B) in one encoding and a
 * base consonant plus the combining nukta (U+091C U+093C) in another, and plenty
 * of people simply type the base consonant alone. Those must all match each
 * other, so nukta letters fold to their base consonant.
 *
 * Deliberately NOT normalized: Urdu's ہ (U+06C1) against Arabic's ه (U+0647).
 * The distinction is meaningful to readers, and Urdu keyboards produce the Urdu
 * letter, so the variation this would absorb barely occurs.
 *
 * A no-op for Latin, CJK, and Hangul messages.
 */
const ARABIC_DIACRITICS_AND_TATWEEL = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ALEF_FORMS = /[\u0622\u0623\u0625\u0671]/g;
const DEVANAGARI_NUKTA = /[\u093C\u0958-\u095F]/g;
const DEVANAGARI_NUKTA_BASE: Record<string, string> = {
    "\u0958": "\u0915", // क़ → क
    "\u0959": "\u0916", // ख़ → ख
    "\u095A": "\u0917", // ग़ → ग
    "\u095B": "\u091C", // ज़ → ज
    "\u095C": "\u0921", // ड़ → ड
    "\u095D": "\u0922", // ढ़ → ढ
    "\u095E": "\u092B", // फ़ → फ
    "\u095F": "\u092F", // य़ → य
};

export function normalizeForRiskMatching(message: string): string {
    return message
        .replace(ARABIC_DIACRITICS_AND_TATWEEL, "")
        .replace(ALEF_FORMS, "\u0627")
        .replace(DEVANAGARI_NUKTA, (character) => DEVANAGARI_NUKTA_BASE[character] ?? "");
}

/**
 * Patterns are matched case-insensitively against the normalized message.
 *
 * Note: `\b` is ASCII-only in JavaScript, so it is used for English only.
 * Matching Arabic, Devanagari, CJK, and Hangul by substring is correct — those
 * scripts do not delimit words with spaces the way the Latin pattern assumes.
 */
const immediateRiskPatterns: RegExp[] = [
    // English (the original reviewed set, unchanged).
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

    // Hindi (Devanagari).
    /आत्महत्या/,
    /खुदकुशी/,
    /खुद को मार/,
    /अपने आप को मार/,
    /जान दे ?(?:दूँ|दूं|दू|देना|देने)/,
    /फांसी लगा/,
    /फाँसी लगा/,
    /जहर खा/,
    /जहर पी/,
    /नस काट/,
    /नसें काट/,
    /मरना चाहत/,
    /मर जाना चाहत/,
    /जीना नहीं चाहत/,
    /जीना नही चाहत/,
    /जिंदा नहीं रहना/,
    /जिंदा नही रहना/,
    /खुद को नुकसान/,
    /अपने आप को नुकसान/,
    /और नहीं जी सकत/,
    /छत से कूद/,
    /खिड़की से कूद/,

    // French.
    /\bsuicid(?:e|er|aire)\b/i,
    /\bme tuer\b/i,
    /\bmettre fin (?:à mes jours|à ma vie)\b/i,
    /\bme faire du mal\b/i,
    /\b(?:je )?veux mourir\b/i,
    /\bplus envie de vivre\b/i,
    /\ben finir avec ma vie\b/i,
    /\bme pendre\b/i,
    /\b(?:sauter|me jeter) du pont\b/i,

    // Spanish.
    /\bsuicid(?:io|arme|arse)\b/i,
    /\bmatarme\b/i,
    /\bquitarme la vida\b/i,
    /\bacabar con mi vida\b/i,
    /\bhacerme daño\b/i,
    /\bquiero morir\b/i,
    /\bno quiero vivir\b/i,
    /\bno quiero seguir viviendo\b/i,
    /\bcortarme las venas\b/i,
    /\bahorcarme\b/i,
    /\b(?:saltar|tirarme) del puente\b/i,

    // Chinese (Simplified). Bare 想死 is deliberately absent: 想死你了 means
    // "I miss you", so the intensifier or subject is required to disambiguate.
    /自杀/,
    /轻生/,
    /自残/,
    /不想活/,
    /活不下去/,
    /割腕/,
    /跳楼/,
    /上吊/,
    /结束(?:自己的)?生命/,
    /了结自己/,
    /(?:真想|好想|我想|想去|我要)死/,

    // Japanese.
    /自殺/,
    /死にたい/,
    /死のうと思/,
    /消えたい/,
    /いなくなりたい/,
    /生きていたくない/,
    /リストカット/,
    /リスカ/,
    /自傷/,
    /自分を傷つけ/,
    /首を吊/,
    /飛び降り/,
    /オーバードーズ/,

    // Korean.
    /자살/,
    /죽고 싶/,
    /죽어버리고 싶/,
    /살고 싶지 않/,
    /사라지고 싶/,
    /자해/,
    /손목(?:을|에)? ?(?:그|긋)/,
    /목을 매/,
    /뛰어내리/,
    /스스로 목숨/,
    /약을 많이 먹/,
    /더 ?이상 못 살겠/,

    // Arabic (matched after normalization, so alef spelling is not repeated here).
    /انتحار/,
    /اقتل نفسي/,
    /انهي حياتي/,
    /اريد ان اموت/,
    /لا اريد ان اعيش/,
    /لا اريد العيش/,
    /اؤذي نفسي/,
    /اجرح نفسي/,
    /اقطع شراييني/,
    /اشنق نفسي/,
    /ارمي نفسي من/,
    /اتمنى الموت/,

    // Urdu.
    /خودکشی/,
    /خود کشی/,
    /اپنے آپ کو مار/,
    /جان دے ?(?:دوں|دو|دینا|دینے)/,
    /پھانسی لگا/,
    /زہر کھا/,
    /نس کاٹ/,
    /رگیں کاٹ/,
    /مرنا چاہت/,
    /جینا نہیں چاہت/,
    /زندہ نہیں رہنا/,
    /اپنے آپ کو نقصان/,
    /اور نہیں جی سکت/,

    // Romanized Hindi/Urdu. Deliberately only the unambiguous forms: people type
    // these without a script, but common Roman words collide with ordinary
    // speech ("mar jaunga" is also hyperbole), so ambiguous ones are left to the
    // model rather than risking a false alarm.
    /\bkhud ?khushi\b/i,
    /\baatm?hatya\b/i,
    /\bjaan de (?:dun|dunga|doon)\b/i,
    /\bmarna chaht[ai]\b/i,
    /\bjeena (?:nahi|nahin) chaht[ai]\b/i,
];

export function requiresCrisisResponse(message: string) {
    if (!message) return false;
    const normalized = normalizeForRiskMatching(message);
    return immediateRiskPatterns.some((pattern) => pattern.test(normalized));
}
