/**
 * UX Fix #14 (Irritant): Bip court + vibration au démarrage de l'écoute.
 *
 * Sans signal, l'utilisateur n'est pas sûr que le micro est vraiment actif
 * et parle parfois avant ou après la fenêtre d'écoute. Le bip + la vibration
 * confirment le démarrage sans avoir à regarder l'écran.
 *
 * Implémentation sans plugin : Web Audio API (bip) + navigator.vibrate
 * (nécessite la permission VIBRATE dans AndroidManifest.xml — permission
 * normale, accordée à l'installation sans prompt).
 */

let audioCtx: AudioContext | null = null;

export function playListeningStartCue(): void {
  // Vibration courte (ignorée silencieusement si non supportée, ex: web desktop)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  } catch { /* vibration non supportée */ }

  // Bip discret (880 Hz, ~150 ms) — volume faible pour ne pas polluer l'enregistrement
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx!.state === 'suspended') {
      audioCtx!.resume().catch(() => { });
    }
    const now = audioCtx!.currentTime;
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain).connect(audioCtx!.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch (e) {
    console.warn('⚠️ [CUE] Bip de démarrage indisponible:', e);
  }
}
