import { GoogleGenerativeAI, GenerationConfig } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  // Disables Gemini 2.5's reasoning pass, which otherwise adds several
  // seconds of latency this extraction task doesn't need.
  generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as GenerationConfig,
});
