/**
 * Server-side Text-to-Speech route.
 *
 * Uses Gemini's TTS model to synthesize audio for ANY of the app's languages,
 * removing the dependency on the user's device having a matching voice installed
 * (the Web Speech API had no Malay/Tamil voice on most machines).
 *
 * Gemini TTS returns raw 16-bit PCM (audio/L16). Browsers can't play raw PCM,
 * so we wrap it in a minimal WAV container and return audio/wav.
 *
 * Reuses the existing GEMINI_API_KEY — no additional credentials required.
 */

import { NextRequest } from "next/server";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const VOICE_NAME = "Kore";
const MAX_CHARS = 5000; // guard against oversized requests
const REQUEST_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "TTS not configured" }, { status: 500 });
  }

  let body: { text?: unknown; slow?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const slow = body.slow === true;

  if (!text) {
    return Response.json({ error: "No text provided" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return Response.json({ error: "Text too long" }, { status: 400 });
  }

  // Gemini TTS auto-detects the language from the text itself; the natural-
  // language instruction controls delivery (pace/tone) for elderly listeners.
  const prompt = `Read the following aloud clearly${
    slow ? " and slowly" : ""
  } in a warm, caring voice for an elderly patient. Read only the content, do not add any commentary:\n\n${text}`;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
      },
    },
  });

  // Gemini TTS occasionally returns finishReason "OTHER" with no audio, or a
  // transient 429/503. Retry a few times before giving up.
  const MAX_ATTEMPTS = 3;
  let quotaExceeded = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: requestBody,
        }
      );

      if (res.status === 429) {
        quotaExceeded = true;
        console.error("[tts] Gemini TTS quota exceeded (429)");
        break; // quota won't recover within this request
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          `[tts] Gemini error (attempt ${attempt}/${MAX_ATTEMPTS}):`,
          res.status,
          detail.slice(0, 200)
        );
      } else {
        const json = await res.json();
        // Audio isn't always the first part — scan all parts.
        const parts: Array<{
          inlineData?: { data?: string; mimeType?: string };
        }> = json?.candidates?.[0]?.content?.parts ?? [];
        const inline =
          parts.find(
            (p) => p.inlineData?.data && /audio/i.test(p.inlineData.mimeType ?? "")
          )?.inlineData ?? parts.find((p) => p.inlineData?.data)?.inlineData;

        if (inline?.data) {
          const pcm = Buffer.from(inline.data, "base64");
          const sampleRate = parseSampleRate(inline.mimeType) ?? 24000;
          const bytes = new Uint8Array(pcmToWav(pcm, sampleRate));
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": "audio/wav",
              "Content-Length": String(bytes.length),
              "Cache-Control": "no-store",
            },
          });
        }

        console.error(
          `[tts] No audio (attempt ${attempt}/${MAX_ATTEMPTS}). finishReason:`,
          json?.candidates?.[0]?.finishReason
        );
      }
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      console.error(
        `[tts] Request failed (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        isAbort ? "timeout" : error
      );
    } finally {
      clearTimeout(timeout);
    }

    // Brief backoff before retrying (skip after the last attempt).
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

/** Extracts the sample rate from a mime type like "audio/L16;codec=pcm;rate=24000". */
function parseSampleRate(mimeType: string | undefined): number | null {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Wraps raw mono 16-bit PCM in a minimal WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}
