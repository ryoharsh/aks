import { defaultMirrorLanguage } from "./languages.ts";

/**
 * The controlled response shown when a turn carries imminent self-harm risk.
 *
 * This text is application-owned, never model output: it is written to the
 * conversation in place of a reply, and it is the one message a person in crisis
 * is guaranteed to see. It exists in every language the product ships so that a
 * user reading Aks in Hindi is not handed an English emergency message at the
 * moment they most need to understand it.
 *
 * Every translation below carries the same four elements as the English
 * original, in the same order, with the same directness:
 *   1. acknowledgement, without interpreting or diagnosing
 *   2. if you might act now, contact emergency services or a crisis line
 *      immediately
 *   3. reach out to someone you trust who can stay with you
 *   4. Aks cannot provide emergency support
 *
 * MAINTENANCE: this copy is safety-critical. Treat edits the way you would treat
 * editing a medical instruction — a native-speaker and clinical review before
 * shipping changes to any string, not just a translation check. Keep the four
 * elements intact; do not soften the urgency or add advice of our own.
 */
export const crisisResponses: Record<string, string> = {
    en: "I'm really sorry you're dealing with this. If you might act on these thoughts now, contact your local emergency services or crisis line immediately, and reach out to someone you trust who can stay with you. Aks can't provide emergency support.",

    hi: "मुझे बहुत खेद है कि आप इससे गुज़र रहे हैं। अगर आप इन विचारों पर अभी अमल कर सकते हैं, तो तुरंत अपनी जगह की आपातकालीन सेवा या क्राइसिस हेल्पलाइन से संपर्क करें, और किसी भरोसेमंद इंसान से कहें जो आपके साथ रह सके। Aks आपातकालीन सहायता नहीं दे सकता।",

    fr: "Je suis vraiment désolé que vous traversiez cela. Si vous risquez de passer à l'acte maintenant, contactez immédiatement les secours ou une ligne d'écoute, et parlez-en à une personne de confiance qui peut rester avec vous. Aks ne peut pas fournir d'aide d'urgence.",

    es: "Lamento mucho que estés pasando por esto. Si pudieras actuar según estos pensamientos ahora, contacta de inmediato con los servicios de emergencia o con una línea de ayuda, y recurre a alguien de confianza que pueda acompañarte. Aks no puede ofrecer ayuda de emergencia.",

    zh: "得知你正在经历这些，我很难过。如果你现在有可能付诸行动，请立即联系当地的急救服务或心理危机热线，并联系一位你信任、能陪在你身边的人。Aks 无法提供紧急援助。",

    ja: "このような状態を抱えていること、本当に心を痛めています。今すぐに行動に移してしまうかもしれない場合は、ただちに地域の救急サービスや相談ホットラインに連絡し、そばにいてくれる信頼できる人に連絡してください。Aks は緊急の支援を提供できません。",

    ko: "이런 일을 겪고 계신다니 정말 마음이 아픕니다. 지금 이 생각대로 행동할 수도 있다면, 즉시 지역 응급 서비스나 위기 상담 전화로 연락하고, 곁에 있어 줄 수 있는 믿을 만한 사람에게 알려 주세요. Aks는 응급 지원을 제공할 수 없습니다.",

    ar: "يؤسفني حقاً أنك تمر بهذا. إن كنت قد تقدم على هذه الأفكار الآن، فاتصل فوراً بخدمات الطوارئ أو بخط دعم الأزمات في مكانك، وتواصل مع شخص تثق به يستطيع البقاء معك. لا يستطيع Aks تقديم دعم الطوارئ.",

    ur: "مجھے بہت افسوس ہے کہ آپ اس سے گزر رہے ہیں۔ اگر آپ ابھی ان خیالات پر عمل کر سکتے ہیں، تو فوراً اپنے علاقے کی ایمرجنسی سروس یا بحرانی ہیلپ لائن سے رابطہ کریں، اور کسی قابلِ اعتماد شخص سے کہیں جو آپ کے ساتھ رہ سکے۔ Aks ایمرجنسی مدد فراہم نہیں کر سکتا۔",
};

/**
 * The crisis response for a response language.
 *
 * An absent or unrecognized code falls back to English, exactly as the
 * conversation's own language resolution does — a safety message must never fail
 * to render because of an unexpected locale.
 */
export function crisisResponseFor(code: string | null | undefined): string {
    return (code ? crisisResponses[code] : undefined) ?? crisisResponses[defaultMirrorLanguage];
}
