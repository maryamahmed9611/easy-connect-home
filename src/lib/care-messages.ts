// Shared, fixed wording for the result screen. Used by the app (on-screen text, browser voice)
// and by /api/tts (natural voice), so what is shown and what is spoken always match.

export type LanguageCode = "en-IN" | "hi-IN" | "kn-IN";

// sent      – request saved AND WhatsApp accepted the alert
// saved     – request saved, but the alert could not be confirmed (failed, not configured, timed out)
// failed    – request could not be saved
// family    – Talk to Family: dialing a saved family contact (nothing is saved)
// no_family – Talk to Family: no family number saved
export type ResultStatus = "sent" | "saved" | "failed" | "family" | "no_family";

export const RESULT_STATUSES = ["sent", "saved", "failed", "family", "no_family"] as const;

const STATUS_TEXT: Record<ResultStatus, Record<LanguageCode, string>> = {
  sent: {
    "en-IN": "Help alert sent.",
    "hi-IN": "मदद का संदेश भेज दिया गया है।",
    "kn-IN": "ಸಹಾಯದ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿದೆ.",
  },
  saved: {
    "en-IN": "Your request was saved, but we could not confirm the alert was sent.",
    "hi-IN": "आपका अनुरोध सेव हो गया है, लेकिन संदेश भेजे जाने की पुष्टि नहीं हो सकी।",
    "kn-IN": "ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಉಳಿಸಲಾಗಿದೆ, ಆದರೆ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿದೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಲು ಆಗಲಿಲ್ಲ.",
  },
  failed: {
    "en-IN": "Your request could not be sent.",
    "hi-IN": "आपका अनुरोध नहीं भेजा जा सका।",
    "kn-IN": "ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಲು ಆಗಲಿಲ್ಲ.",
  },
  family: {
    "en-IN": "Calling your family now.",
    "hi-IN": "आपके परिवार को अभी कॉल कर रहे हैं।",
    "kn-IN": "ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ಈಗ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ.",
  },
  no_family: {
    "en-IN": "No family number is saved.",
    "hi-IN": "परिवार का कोई नंबर सेव नहीं है।",
    "kn-IN": "ಕುಟುಂಬದ ಯಾವುದೇ ಸಂಖ್ಯೆ ಉಳಿಸಲಾಗಿಲ್ಲ.",
  },
};

const CALLING_NOW: Record<LanguageCode, string> = {
  "en-IN": "Calling now.",
  "hi-IN": "अभी कॉल कर रहे हैं।",
  "kn-IN": "ಈಗ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ.",
};

const PLEASE_CALL: Record<LanguageCode, string> = {
  "en-IN": "Please call for help.",
  "hi-IN": "कृपया मदद के लिए कॉल करें।",
  "kn-IN": "ದಯವಿಟ್ಟು ಸಹಾಯಕ್ಕಾಗಿ ಕರೆ ಮಾಡಿ.",
};

export function resultMessage(status: ResultStatus, calling: boolean, lang: LanguageCode): string {
  const statusText = STATUS_TEXT[status][lang];
  if (status === "family") return statusText;
  const parts = [statusText];
  if (calling) parts.push(CALLING_NOW[lang]);
  else if (status !== "sent") parts.push(PLEASE_CALL[lang]);
  return parts.join(" ");
}

export const RESULT_HEADING: Record<ResultStatus, Record<LanguageCode, string>> = {
  sent: { "en-IN": "Request confirmed", "hi-IN": "अनुरोध स्वीकार हुआ", "kn-IN": "ವಿನಂತಿ ದೃಢಪಟ್ಟಿದೆ" },
  saved: { "en-IN": "Request saved", "hi-IN": "अनुरोध सेव हुआ", "kn-IN": "ವಿನಂತಿ ಉಳಿಸಲಾಗಿದೆ" },
  failed: { "en-IN": "Request not sent", "hi-IN": "अनुरोध नहीं भेजा गया", "kn-IN": "ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿಲ್ಲ" },
  family: { "en-IN": "Calling your family", "hi-IN": "परिवार को कॉल कर रहे हैं", "kn-IN": "ಕುಟುಂಬಕ್ಕೆ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ" },
  no_family: { "en-IN": "No family number", "hi-IN": "परिवार का नंबर नहीं है", "kn-IN": "ಕುಟುಂಬದ ಸಂಖ್ಯೆ ಇಲ್ಲ" },
};

export type CareActionName = "Medical Support" | "Daily Needs" | "Talk to Family";

export const ACTION_LABEL: Record<CareActionName, Record<LanguageCode, string>> = {
  "Medical Support": { "en-IN": "Medical Support", "hi-IN": "चिकित्सा सहायता", "kn-IN": "ವೈದ್ಯಕೀಯ ಸಹಾಯ" },
  "Daily Needs": { "en-IN": "Daily Needs", "hi-IN": "रोज़मर्रा की ज़रूरतें", "kn-IN": "ದೈನಂದಿನ ಅಗತ್ಯಗಳು" },
  "Talk to Family": { "en-IN": "Talk to Family", "hi-IN": "परिवार से बात करें", "kn-IN": "ಕುಟುಂಬದೊಂದಿಗೆ ಮಾತನಾಡಿ" },
};

// Text on the listening, waiting and result screens.
export const UI_TEXT = {
  listening: { "en-IN": "Listening...", "hi-IN": "सुन रहे हैं...", "kn-IN": "ಆಲಿಸುತ್ತಿದೆ..." },
  speakIn: { "en-IN": "Speak in English", "hi-IN": "हिंदी में बोलें", "kn-IN": "ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ" },
  whatIHeard: { "en-IN": "What I heard", "hi-IN": "मैंने क्या सुना", "kn-IN": "ನಾನು ಕೇಳಿದ್ದು" },
  confirm: { "en-IN": "Confirm Request", "hi-IN": "अनुरोध भेजें", "kn-IN": "ವಿನಂತಿ ಕಳುಹಿಸಿ" },
  sending: {
    "en-IN": "Sending your request, please wait",
    "hi-IN": "आपका अनुरोध भेजा जा रहा है, कृपया प्रतीक्षा करें",
    "kn-IN": "ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ, ದಯವಿಟ್ಟು ಕಾಯಿರಿ",
  },
  callAmbulance: { "en-IN": "Call Ambulance", "hi-IN": "एम्बुलेंस को कॉल करें", "kn-IN": "ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗೆ ಕರೆ ಮಾಡಿ" },
  backHome: { "en-IN": "Back to home", "hi-IN": "होम पर वापस जाएं", "kn-IN": "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ" },
} satisfies Record<string, Record<LanguageCode, string>>;

export function callLabel(name: string, lang: LanguageCode): string {
  const who = name.trim() || { "en-IN": "now", "hi-IN": "अभी", "kn-IN": "ಈಗ" }[lang];
  if (lang === "hi-IN") return name.trim() ? `${who} को कॉल करें` : `${who} कॉल करें`;
  if (lang === "kn-IN") return name.trim() ? `${who} ಗೆ ಕರೆ ಮಾಡಿ` : `${who} ಕರೆ ಮಾಡಿ`;
  return `Call ${who}`;
}

export type SpeechIssue = "unsupported" | "not_allowed" | "no_speech" | "could_not_start";

export const SPEECH_ISSUE_TEXT: Record<SpeechIssue, Record<LanguageCode, string>> = {
  unsupported: {
    "en-IN": "Voice recognition is not available in this browser. You can continue using the button below.",
    "hi-IN": "इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। आप नीचे दिए बटन से आगे बढ़ सकते हैं।",
    "kn-IN": "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಲಭ್ಯವಿಲ್ಲ. ಕೆಳಗಿನ ಬಟನ್ ಬಳಸಿ ಮುಂದುವರಿಯಬಹುದು.",
  },
  not_allowed: {
    "en-IN": "Microphone access was not allowed. Please enable it in your browser settings, or continue using the button below.",
    "hi-IN": "माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में इसे चालू करें, या नीचे दिए बटन से आगे बढ़ें।",
    "kn-IN": "ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನೀಡಲಾಗಿಲ್ಲ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅದನ್ನು ಆನ್ ಮಾಡಿ, ಅಥವಾ ಕೆಳಗಿನ ಬಟನ್ ಬಳಸಿ ಮುಂದುವರಿಯಿರಿ.",
  },
  no_speech: {
    "en-IN": "I could not hear any speech. Please go back and try again, or continue using the button below.",
    "hi-IN": "मुझे कोई आवाज़ सुनाई नहीं दी। कृपया फिर से कोशिश करें, या नीचे दिए बटन से आगे बढ़ें।",
    "kn-IN": "ನನಗೆ ಯಾವುದೇ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಕೆಳಗಿನ ಬಟನ್ ಬಳಸಿ ಮುಂದುವರಿಯಿರಿ.",
  },
  could_not_start: {
    "en-IN": "Voice listening could not start. You can continue using the button below.",
    "hi-IN": "आवाज़ सुनना शुरू नहीं हो सका। आप नीचे दिए बटन से आगे बढ़ सकते हैं।",
    "kn-IN": "ಧ್ವನಿ ಆಲಿಸುವಿಕೆ ಆರಂಭವಾಗಲಿಲ್ಲ. ಕೆಳಗಿನ ಬಟನ್ ಬಳಸಿ ಮುಂದುವರಿಯಬಹುದು.",
  },
};

// Finds a saved contact whose name was spoken, e.g. "I want to talk to Ravi" or "call C2".
// Works best when the name is recognised in the same script it was saved in.
export function findSpokenContact<T extends { name: string; phone: string }>(spoken: string, contacts: T[]): T | undefined {
  const splitWords = (value: string) => value.toLowerCase().normalize("NFC").split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  const words = new Set(splitWords(spoken));
  const compact = splitWords(spoken).join("");
  let best: T | undefined;
  let bestLength = 0;
  for (const contact of contacts) {
    if (!contact.phone) continue;
    const parts = splitWords(contact.name);
    const fullName = parts.join("");
    const matches =
      parts.some((part) => part.length >= 2 && words.has(part)) ||
      // Kannada/Hindi often join endings onto names ("ಅಮ್ಮನಿಗೆ" = "to Amma"), so allow a prefix match there.
      parts.some((part) => part.length >= 2 && /[^\x00-\x7F]/.test(part) && [...words].some((word) => word.startsWith(part))) ||
      // Short names with a digit ("C2") may be heard as "c 2".
      (/\d/.test(fullName) && fullName.length >= 2 && compact.includes(fullName));
    if (matches && fullName.length > bestLength) {
      best = contact;
      bestLength = fullName.length;
    }
  }
  return best;
}
