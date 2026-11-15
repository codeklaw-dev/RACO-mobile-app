/**
 * Pure helpers for server voice: no native modules, so they run in tests.
 */

/** Microphone level in dBFS (about -160 to 0) to 0-1 for the orb. */
export function meterLevel(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 50) / 40));
}

/**
 * Decides when a hands-free recording is finished from the mic level:
 * after some speech, a pause ends it; with no speech at all, it gives up.
 * Speech and silence are judged against the room's own noise floor (the
 * quietest level so far), so background noise doesn't keep it open.
 * Feed it a level every ~100 ms; it returns what to do.
 */
export class VoiceActivity {
  private heard = false;
  private floor = 0;
  private quietSince: number | null = null;
  private readonly startedAt: number;

  constructor(
    now: number,
    private readonly pauseMs = 1000,
    private readonly giveUpMs = 7000,
    private readonly maxMs = 30_000,
  ) {
    this.startedAt = now;
  }

  push(db: number | undefined, now: number): 'continue' | 'done' | 'nothing' {
    const level = Math.max(db ?? -160, -80);
    this.floor = Math.min(this.floor, level);
    // Noise is never assumed louder than -40 dB, so speaking straight away still counts as speech.
    const speechLine = Math.max(Math.min(this.floor, -40) + 15, -45);
    if (level > speechLine) {
      this.heard = true;
      this.quietSince = null;
    } else if (level < speechLine - 6 && this.heard) {
      this.quietSince ??= now;
    }
    if (now - this.startedAt >= this.maxMs) return this.heard ? 'done' : 'nothing';
    if (!this.heard) return now - this.startedAt >= this.giveUpMs ? 'nothing' : 'continue';
    return this.quietSince !== null && now - this.quietSince >= this.pauseMs ? 'done' : 'continue';
  }
}

/**
 * Splits text into pieces small enough to synthesize quickly, on sentence
 * boundaries where possible, so the first words play sooner.
 */
export function splitForSpeech(text: string, max = 280): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) ?? [];
  const out: string[] = [];
  let piece = '';
  for (const s of sentences) {
    if (piece && (piece + s).length > max) {
      out.push(piece.trim());
      piece = '';
    }
    if (s.length > max) {
      // One very long sentence: break it between words.
      for (const word of s.split(' ')) {
        if (piece && (piece + word).length + 1 > max) {
          out.push(piece.trim());
          piece = '';
        }
        piece += `${word} `;
      }
    } else {
      piece += s;
    }
  }
  if (piece.trim()) out.push(piece.trim());
  return out;
}
