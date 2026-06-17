/**
 * VNI-Windows → Unicode converter for Vietnamese DXF text.
 *
 * VNI encoding stores Vietnamese diacritics as POST-VOWEL modifier characters
 * from the Latin-1 Supplement block (0x80–0xFF). When read with a standard font,
 * the text appears garbled (e.g. "MAÙI" instead of "MÁI").
 *
 * This module detects VNI-encoded text and converts it to proper Unicode.
 */

// ── Modifier characters (Latin-1 → VNI meaning) ────────────────────────────

// Single-char replacements (not vowel-dependent)
const DIRECT: [string, string][] = [
  ["Ñ", "Đ"], ["ñ", "đ"],
];

// Tone marks placed after a (possibly modified) vowel
const TONE_ACUTE  = "\u00D9"; // Ù
const TONE_GRAVE  = "\u00D8"; // Ø
const TONE_HOOK   = "\u00DB"; // Û (hỏi)
const TONE_TILDE  = "\u00DA"; // Ú (ngã)  — note: collides with Latin Ú
const TONE_DOT    = "\u00CF"; // Ï (nặng)

// Combined circumflex+tone (shorthand, avoids 3-char sequences)
const TONE_CIRC_GRAVE = "\u00C0"; // À = circumflex + grave combined
const TONE_CIRC_ACUTE = "\u00C1"; // Á = circumflex + acute combined  (rare, but possible)
const TONE_CIRC_HOOK  = "\u00C3"; // Ã = circumflex + hook combined
const TONE_CIRC_TILDE = "\u00C4"; // Ä = circumflex + tilde combined
const TONE_CIRC_DOT   = "\u00C5"; // Å = circumflex + dot combined

// Base modification marks placed directly after vowel
const MOD_CIRCUMFLEX = "\u00C2"; // Â
const MOD_HORN       = "\u00D6"; // Ö  (for Ơ, Ư)
const MOD_BREVE      = "\u00D2"; // Ò  (for Ă)

// ── Vietnamese vowel composition tables ──────────────────────────────────────

// Base vowels → with circumflex
const CIRCUMFLEX: Record<string, string> = {
  A: "Â", a: "â", E: "Ê", e: "ê", O: "Ô", o: "ô",
};

// Base vowels → with horn
const HORN: Record<string, string> = {
  O: "Ơ", o: "ơ", U: "Ư", u: "ư",
};

// Base vowels → with breve
const BREVE: Record<string, string> = {
  A: "Ă", a: "ă",
};

// Apply tone to any Vietnamese vowel (base, circumflex, horn, or breve)
type ToneType = "acute" | "grave" | "hook" | "tilde" | "dot";

const TONE_TABLE: Record<string, Record<ToneType, string>> = {
  // Base vowels
  A: { acute: "Á", grave: "À", hook: "Ả", tilde: "Ã", dot: "Ạ" },
  a: { acute: "á", grave: "à", hook: "ả", tilde: "ã", dot: "ạ" },
  E: { acute: "É", grave: "È", hook: "Ẻ", tilde: "Ẽ", dot: "Ẹ" },
  e: { acute: "é", grave: "è", hook: "ẻ", tilde: "ẽ", dot: "ẹ" },
  I: { acute: "Í", grave: "Ì", hook: "Ỉ", tilde: "Ĩ", dot: "Ị" },
  i: { acute: "í", grave: "ì", hook: "ỉ", tilde: "ĩ", dot: "ị" },
  O: { acute: "Ó", grave: "Ò", hook: "Ỏ", tilde: "Õ", dot: "Ọ" },
  o: { acute: "ó", grave: "ò", hook: "ỏ", tilde: "õ", dot: "ọ" },
  U: { acute: "Ú", grave: "Ù", hook: "Ủ", tilde: "Ũ", dot: "Ụ" },
  u: { acute: "ú", grave: "ù", hook: "ủ", tilde: "ũ", dot: "ụ" },
  Y: { acute: "Ý", grave: "Ỳ", hook: "Ỷ", tilde: "Ỹ", dot: "Ỵ" },
  y: { acute: "ý", grave: "ỳ", hook: "ỷ", tilde: "ỹ", dot: "ỵ" },
  // Circumflex vowels
  "Â": { acute: "Ấ", grave: "Ầ", hook: "Ẩ", tilde: "Ẫ", dot: "Ậ" },
  "â": { acute: "ấ", grave: "ầ", hook: "ẩ", tilde: "ẫ", dot: "ậ" },
  "Ê": { acute: "Ế", grave: "Ề", hook: "Ể", tilde: "Ễ", dot: "Ệ" },
  "ê": { acute: "ế", grave: "ề", hook: "ể", tilde: "ễ", dot: "ệ" },
  "Ô": { acute: "Ố", grave: "Ồ", hook: "Ổ", tilde: "Ỗ", dot: "Ộ" },
  "ô": { acute: "ố", grave: "ồ", hook: "ổ", tilde: "ỗ", dot: "ộ" },
  // Horn vowels
  "Ơ": { acute: "Ớ", grave: "Ờ", hook: "Ở", tilde: "Ỡ", dot: "Ợ" },
  "ơ": { acute: "ớ", grave: "ờ", hook: "ở", tilde: "ỡ", dot: "ợ" },
  "Ư": { acute: "Ứ", grave: "Ừ", hook: "Ử", tilde: "Ữ", dot: "Ự" },
  "ư": { acute: "ứ", grave: "ừ", hook: "ử", tilde: "ữ", dot: "ự" },
  // Breve vowels
  "Ă": { acute: "Ắ", grave: "Ằ", hook: "Ẳ", tilde: "Ẵ", dot: "Ặ" },
  "ă": { acute: "ắ", grave: "ằ", hook: "ẳ", tilde: "ẵ", dot: "ặ" },
};

const BASE_VOWELS = new Set("AaEeIiOoUuYy");

function isBaseVowel(ch: string): boolean {
  return BASE_VOWELS.has(ch);
}

function getTone(ch: string): ToneType | null {
  if (ch === TONE_ACUTE) return "acute";
  if (ch === TONE_GRAVE) return "grave";
  if (ch === TONE_HOOK)  return "hook";
  if (ch === TONE_TILDE) return "tilde";
  if (ch === TONE_DOT)   return "dot";
  return null;
}

function getCombinedCircTone(ch: string): ToneType | null {
  if (ch === TONE_CIRC_GRAVE) return "grave";
  if (ch === TONE_CIRC_ACUTE) return "acute";
  if (ch === TONE_CIRC_HOOK)  return "hook";
  if (ch === TONE_CIRC_TILDE) return "tilde";
  if (ch === TONE_CIRC_DOT)   return "dot";
  return null;
}

// ── Main converter ──────────────────────────────────────────────────────────

export function convertVniToUnicode(text: string): string {
  // Step 1: Direct single-char replacements
  let s = text;
  for (const [from, to] of DIRECT) {
    s = s.split(from).join(to);
  }

  // Step 2: Process vowel + modifier sequences (character by character)
  const out: string[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (isBaseVowel(ch)) {
      const next = i + 1 < s.length ? s[i + 1] : "";
      const next2 = i + 2 < s.length ? s[i + 2] : "";

      // Check for base modification (circumflex, horn, breve)
      if (next === MOD_CIRCUMFLEX && CIRCUMFLEX[ch]) {
        const modified = CIRCUMFLEX[ch];
        // Check for tone after circumflex: vowel + Â + tone
        const tone = getTone(next2);
        if (tone && TONE_TABLE[modified]) {
          out.push(TONE_TABLE[modified][tone]);
          i += 3;
        } else {
          out.push(modified);
          i += 2;
        }
      } else if (next === MOD_HORN && HORN[ch]) {
        const modified = HORN[ch];
        const tone = getTone(next2);
        if (tone && TONE_TABLE[modified]) {
          out.push(TONE_TABLE[modified][tone]);
          i += 3;
        } else {
          out.push(modified);
          i += 2;
        }
      } else if (next === MOD_BREVE && BREVE[ch]) {
        const modified = BREVE[ch];
        const tone = getTone(next2);
        if (tone && TONE_TABLE[modified]) {
          out.push(TONE_TABLE[modified][tone]);
          i += 3;
        } else {
          out.push(modified);
          i += 2;
        }
      }
      // Check for combined circumflex+tone shortcuts (e.g. AÀ → Ầ)
      else {
        const circTone = getCombinedCircTone(next);
        if (circTone && CIRCUMFLEX[ch]) {
          const circumflexed = CIRCUMFLEX[ch];
          if (TONE_TABLE[circumflexed]) {
            out.push(TONE_TABLE[circumflexed][circTone]);
            i += 2;
            continue;
          }
        }
        // Check for simple tone mark after base vowel
        const tone = getTone(next);
        if (tone && TONE_TABLE[ch]) {
          out.push(TONE_TABLE[ch][tone]);
          i += 2;
        } else {
          out.push(ch);
          i += 1;
        }
      }
    } else {
      out.push(ch);
      i += 1;
    }
  }

  return out.join("");
}

// ── VNI detection heuristic ─────────────────────────────────────────────────

const VNI_MODIFIERS = new Set([
  TONE_ACUTE, TONE_GRAVE, TONE_HOOK, TONE_TILDE, TONE_DOT,
  MOD_CIRCUMFLEX, MOD_HORN, MOD_BREVE,
  TONE_CIRC_GRAVE, TONE_CIRC_ACUTE, TONE_CIRC_HOOK, TONE_CIRC_TILDE, TONE_CIRC_DOT,
  "Ñ", "ñ",
]);

/**
 * Detects if a string likely uses VNI encoding by counting
 * vowel + modifier sequences.
 */
export function detectVniEncoding(text: string): boolean {
  let hits = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (isBaseVowel(text[i]) && VNI_MODIFIERS.has(text[i + 1])) {
      hits++;
    }
  }
  // Also count standalone Ñ/ñ (Đ/đ)
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "Ñ" || text[i] === "ñ") hits++;
  }
  // If we see ≥3 VNI patterns, it's very likely VNI
  return hits >= 3;
}
