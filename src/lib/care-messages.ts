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

export const RESULT_HEADING: Record<ResultStatus, string> = {
  sent: "Request confirmed",
  saved: "Request saved",
  failed: "Request not sent",
  family: "Calling your family",
  no_family: "No family number",
};
