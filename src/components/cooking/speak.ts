"use client";

// Reads text aloud in Spanish (Mexico) when the browser can (REQ-22, REQ-23). Resolves when the reading ends,
// so listening can resume after it (REQ-25). Without speech synthesis it resolves at once.
export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function spanishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase() === "es-mx") ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ?? null;
}

export function speak(text: string): Promise<void> {
  if (!canSpeak() || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    const voice = spanishVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
