/**
 * Server-side Text-to-Speech route.
 *
 * Uses Google Cloud Text-to-Speech to synthesize audio for languages the
 * user's device has no working voice for (Malay/Tamil had no Web Speech API
 * voice on most machines, or a broken one — see useTTS.ts).
 *
 * Previously used Gemini's TTS preview model, but its free tier caps at 10
 * requests/day/project — unusable for real traffic. Cloud TTS is a dedicated
 * TTS product with a much larger free tier (4M chars/month for Standard
 * voices) and native voices for every language this app supports.
 */

import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import textToSpeech, { protos } from "@google-cloud/text-to-speech";
import { createClient } from "@/services/supabase/server";

const MAX_CHARS = 5000; // guard against oversized requests
const MAX_ATTEMPTS = 3;

const VOICES: Record<string, { languageCode: string; name: string }> = {
  en: { languageCode: "en-US", name: "en-US-Standard-C" },
  zh: { languageCode: "cmn-CN", name: "cmn-CN-Standard-A" },
  ms: { languageCode: "ms-MY", name: "ms-MY-Standard-A" },
  ta: { languageCode: "ta-IN", name: "ta-IN-Standard-A" },
};

// Circuit breaker: once Cloud TTS reports quota/rate-limit exhaustion, stop
// calling it for a cooldown window instead of retrying into more failures.
const QUOTA_COOLDOWN_MS = 60_000;
let quotaBlockedUntil = 0;

let client: InstanceType<typeof textToSpeech.TextToSpeechClient> | null = null;
function getClient() {
  if (client) return client;
  const raw = process.env.GOOGLE_TTS_CREDENTIALS_JSON;
  if (!raw) throw new Error("GOOGLE_TTS_CREDENTIALS_JSON is not configured");
  const credentials = JSON.parse(raw);
  client = new textToSpeech.TextToSpeechClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
  });
  return client;
}

function cacheKeyFor(text: string, language: string, slow: boolean): string {
  return createHash("sha256")
    .update(`cloud-tts:${language}:${slow ? "slow" : "norm"}:${text}`)
    .digest("hex");
}

async function readFromCache(cacheKey: string): Promise<Buffer | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tts_cache")
    .select("audio_base64")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  return data ? Buffer.from(data.audio_base64, "base64") : null;
}

async function writeToCache(cacheKey: string, audio: Buffer): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tts_cache")
    .upsert({ cache_key: cacheKey, audio_base64: audio.toString("base64") });
  if (error) console.error("[tts] Failed to write cache entry:", error.message);
}

export async function POST(request: NextRequest) {
  if (!process.env.GOOGLE_TTS_CREDENTIALS_JSON) {
    return Response.json({ error: "TTS not configured" }, { status: 500 });
  }

  let body: { text?: unknown; slow?: unknown; language?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const slow = body.slow === true;
  const language = typeof body.language === "string" ? body.language : "en";
  const voice = VOICES[language];

  if (!text) {
    return Response.json({ error: "No text provided" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return Response.json({ error: "Text too long" }, { status: 400 });
  }
  if (!voice) {
    return Response.json({ error: "Unsupported language" }, { status: 400 });
  }

  const cacheKey = cacheKeyFor(text, language, slow);

  try {
    const cached = await readFromCache(cacheKey);
    if (cached) {
      return new Response(new Uint8Array(cached), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(cached.length),
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (error) {
    console.error("[tts] Cache lookup failed:", error);
  }

  if (Date.now() < quotaBlockedUntil) {
    console.error("[tts] Skipping Cloud TTS call, still in quota cooldown");
    return Response.json(
      { error: "quota_exceeded", message: "Speech service is temporarily rate-limited. Please try again shortly." },
      { status: 503 }
    );
  }

  const request_: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
    input: { text },
    voice: { languageCode: voice.languageCode, name: voice.name },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: slow ? 0.75 : 1.0,
    },
  };

  let quotaExceeded = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const [response] = await getClient().synthesizeSpeech(request_);
      const audioContent = response.audioContent;
      if (audioContent) {
        const audio = Buffer.from(audioContent as Uint8Array);
        writeToCache(cacheKey, audio).catch((error) =>
          console.error("[tts] Cache write threw:", error)
        );
        return new Response(new Uint8Array(audio), {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(audio.length),
            "Cache-Control": "no-store",
          },
        });
      }
      console.error(`[tts] No audio content (attempt ${attempt}/${MAX_ATTEMPTS})`);
    } catch (error) {
      const code = (error as { code?: number })?.code;
      // gRPC code 8 = RESOURCE_EXHAUSTED (quota/rate limit)
      if (code === 8) {
        quotaExceeded = true;
        quotaBlockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
        console.error("[tts] Cloud TTS quota exceeded");
        break;
      }
      console.error(
        `[tts] Request failed (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        error instanceof Error ? error.message : error
      );
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }

  if (quotaExceeded) {
    return Response.json(
      { error: "quota_exceeded", message: "Speech service is temporarily rate-limited. Please try again shortly." },
      { status: 503 }
    );
  }
  return Response.json(
    { error: "Speech synthesis failed after retries" },
    { status: 502 }
  );
}
