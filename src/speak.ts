export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
export function speak(text: string) {
  if (!canSpeak) return;
  const s = window.speechSynthesis; s.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.8;
  const v = s.getVoices().find(v => /zh[-_]CN/i.test(v.lang)) || s.getVoices().find(v => /^zh/i.test(v.lang));
  if (v) u.voice = v;
  s.speak(u);
}
