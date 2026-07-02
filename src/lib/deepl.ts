/**
 * Runtime DeepL client — translates dynamically generated content (e.g. a
 * medication purpose inferred by Gemini) into the app's non-English
 * languages at request time.
 *
 * Distinct from src/lib/translator.ts (which uses Gemini): purpose text is
 * *generated* by Gemini from the medication name during OCR extraction, then
 * translated here via DeepL so that translation load doesn't add to the
 * Gemini quota already spent on extraction.
 */

import { applyGlossary, type GlossaryLang } from "./glossary";

const DEEPL_API = "https://api-free.deepl.com/v2/translate";

export type DeepLLang = GlossaryLang;
export const DEEPL_LANGUAGES = ["ZH", "MS", "TA"] as const satisfies readonly DeepLLang[];

async function deeplTranslate(texts: string[], targetLang: DeepLLang): Promise<string[]> {
  const key = process.env.DEEPL_KEY;
  if (!key) throw new Error("DEEPL_KEY is not configured");

  const res = await fetch(DEEPL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `DeepL-Auth-Key ${key}`,
    },
    body: JSON.stringify({
      text: texts,
      target_lang: targetLang,
      source_lang: "EN",
      preserve_formatting: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepL error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => applyGlossary(t.text, targetLang));
}

/**
 * Translates a batch of purpose strings into ZH/MS/TA in parallel.
 * `null` entries (no purpose extracted) stay `null` in every language.
 * Non-fatal: a failed language falls back to `null` for every item rather
 * than throwing, so a DeepL outage never breaks the scan itself.
 */
export async function translatePurposes(
  purposes: (string | null)[]
): Promise<Record<DeepLLang, (string | null)[]>> {
  const texts = purposes.map((p) => p ?? "");
  const hasContent = texts.some((t) => t.trim());

  if (!hasContent) {
    return { ZH: purposes.map(() => null), MS: purposes.map(() => null), TA: purposes.map(() => null) };
  }

  const perLang = await Promise.all(
    DEEPL_LANGUAGES.map(async (lang) => {
      try {
        const translated = await deeplTranslate(texts, lang);
        return purposes.map((source, i) => (source === null ? null : translated[i]));
      } catch (error) {
        console.error(
          `[deepl] Purpose translation failed for ${lang} (non-fatal):`,
          error instanceof Error ? error.message : error
        );
        return purposes.map(() => null);
      }
    })
  );

  return { ZH: perLang[0], MS: perLang[1], TA: perLang[2] };
}
