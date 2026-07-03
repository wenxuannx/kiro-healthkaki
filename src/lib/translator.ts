/**
 * Dynamic Translation Module
 *
 * Translates runtime content (OCR'd medication info, subsidy scheme
 * descriptions) into the app's non-English languages using Gemini.
 *
 * Design goals:
 * - One Gemini call per batch (multiple items × 3 languages in a single request)
 * - Non-fatal: any failure returns `null` translations so callers fall back to
 *   the original English text — translation must never break a scan.
 * - In-memory cache keyed by the source text, so identical strings (e.g. the
 *   same subsidy description across scans) are only translated once per process.
 *
 * Requirements: 6.5 (subsidy display language), 9.3 (medication display language)
 */

import { geminiModel } from "@/services/gemini";
import type { SupportedLanguage } from "@/types";

/** The languages we translate INTO. English (en-SG) is always the source. */
export const NON_ENGLISH_LANGUAGES = [
  "cmn-Hans-CN",
  "ms-MY",
  "ta-IN",
] as const satisfies readonly Exclude<SupportedLanguage, "en-SG">[];

export type NonEnglishLanguage = (typeof NON_ENGLISH_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<NonEnglishLanguage, string> = {
  "cmn-Hans-CN": "Simplified Chinese",
  "ms-MY": "Malay (Bahasa Melayu)",
  "ta-IN": "Tamil",
};

/** Translated field set for one item, or null when no translation is available. */
export type FieldTranslations<K extends string> = Record<K, string>;
export type TranslationResult<K extends string> = Record<
  NonEnglishLanguage,
  FieldTranslations<K> | null
>;

/** Module-level cache: source-text signature → translation result. */
const translationCache = new Map<string, TranslationResult<string>>();

function nullResult<K extends string>(): TranslationResult<K> {
  return { "cmn-Hans-CN": null, "ms-MY": null, "ta-IN": null };
}

function isEmptyItem<K extends string>(item: FieldTranslations<K>): boolean {
  return Object.values(item).every(
    (v) => typeof v !== "string" || v.trim().length === 0
  );
}

function cacheKey<K extends string>(item: FieldTranslations<K>): string {
  // Stable key: sorted entries so field order doesn't matter.
  const entries = Object.entries(item).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * Translates a batch of field-sets into all non-English languages.
 *
 * The returned array is aligned by index with `items`. For each item, each
 * language is either a fully-populated field object or `null` (fall back to
 * English). Missing individual fields fall back to the English source so no
 * translated field is ever empty.
 */
export async function translateBatch<K extends string>(
  items: FieldTranslations<K>[]
): Promise<TranslationResult<K>[]> {
  if (items.length === 0) return [];

  const results: (TranslationResult<K> | undefined)[] = new Array(items.length);
  const pending: { index: number; item: FieldTranslations<K> }[] = [];

  // Resolve from cache / short-circuit empty items first.
  items.forEach((item, index) => {
    if (isEmptyItem(item)) {
      results[index] = nullResult<K>();
      return;
    }
    const cached = translationCache.get(cacheKey(item));
    if (cached) {
      results[index] = cached as TranslationResult<K>;
      return;
    }
    pending.push({ index, item });
  });

  if (pending.length > 0) {
    let fresh: TranslationResult<K>[];
    try {
      fresh = await callGemini(pending.map((p) => p.item));
    } catch (error) {
      console.error(
        "[translator] Batch translation failed (non-fatal, falling back to English):",
        error instanceof Error ? error.message : error
      );
      fresh = pending.map(() => nullResult<K>());
    }

    pending.forEach((p, i) => {
      const result = fresh[i] ?? nullResult<K>();
      results[p.index] = result;
      // Only cache successful (non-null) translations.
      if (NON_ENGLISH_LANGUAGES.some((lang) => result[lang] !== null)) {
        translationCache.set(cacheKey(p.item), result as TranslationResult<string>);
      }
    });
  }

  return results.map((r) => r ?? nullResult<K>());
}

/**
 * Convenience wrapper for translating a single field-set.
 */
export async function translateFields<K extends string>(
  item: FieldTranslations<K>
): Promise<TranslationResult<K>> {
  const [result] = await translateBatch([item]);
  return result ?? nullResult<K>();
}

// --- Internal Gemini call ---

async function callGemini<K extends string>(
  items: FieldTranslations<K>[]
): Promise<TranslationResult<K>[]> {
  const languageList = NON_ENGLISH_LANGUAGES.map(
    (code) => `"${code}" (${LANGUAGE_LABELS[code]})`
  ).join(", ");

  const prompt = `You are a medical translator for elderly patients in Singapore.

Translate the VALUES in the following JSON array of items from English into each of these target languages: ${languageList}.

Items (English source):
${JSON.stringify(items, null, 2)}

Rules:
- Keep the JSON keys exactly as given — translate only the string values.
- Preserve proper names, brand names, medication names, government scheme names, numbers, dosages, and units unchanged.
- Use simple, plain language suitable for elderly readers.
- Return ONE item per input item, in the same order.

Respond ONLY with a JSON object of this exact shape (no markdown, no commentary):
{
${NON_ENGLISH_LANGUAGES.map(
  (code) => `  "${code}": [ /* one object per input item, same keys as input */ ]`
).join(",\n")}
}`;

  const result = await geminiModel.generateContent(prompt);
  const text = result.response.text();
  const parsed = parseTranslationResponse(text);

  const keys = items.length > 0 ? (Object.keys(items[0]) as K[]) : [];

  return items.map((sourceItem, index) => {
    const out = nullResult<K>();
    for (const lang of NON_ENGLISH_LANGUAGES) {
      const arr = parsed[lang];
      const translatedItem = Array.isArray(arr) ? arr[index] : undefined;
      if (!translatedItem || typeof translatedItem !== "object") {
        continue; // leave null → caller falls back to English
      }
      const fields = {} as FieldTranslations<K>;
      for (const key of keys) {
        const value = (translatedItem as Record<string, unknown>)[key];
        // Fall back to the English source for any missing/blank field so no
        // translated field is ever empty (satisfies display properties 9/15).
        fields[key] =
          typeof value === "string" && value.trim().length > 0
            ? value
            : sourceItem[key];
      }
      out[lang] = fields;
    }
    return out;
  });
}

/**
 * Parses the Gemini translation response, tolerating markdown code fences.
 */
function parseTranslationResponse(
  text: string
): Partial<Record<NonEnglishLanguage, unknown[]>> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    cleaned = cleaned.trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        throw new Error("Failed to parse translation response JSON");
      }
    }
    throw new Error("No JSON object found in translation response");
  }
}
