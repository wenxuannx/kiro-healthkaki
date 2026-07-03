"use client";

import { AlertTriangle } from "lucide-react";
import type { MedicationResult, SupportedLanguage } from "@/types";
import TTSControls from "./TTSControls";

// ============================================================
// MedicationResultDisplay Component
// Requirements: 9.3, 9.10, 9.11, 9.12
// ============================================================

interface MedicationResultDisplayProps {
  medication: MedicationResult;
  language: SupportedLanguage;
  showWarning: boolean; // true when confidence < 0.7
}

/**
 * Displays medication identification results including name, purpose,
 * and dosage frequency in the selected language. Falls back to English
 * if translation is unavailable. Shows a low-confidence warning banner
 * when showWarning is true, and includes TTS read-aloud functionality.
 */
export default function MedicationResultDisplay({
  medication,
  language,
  showWarning,
}: MedicationResultDisplayProps) {
  // Resolve translated fields, falling back to English if unavailable
  const translation = medication.translations[language];
  const purpose = translation?.purpose ?? medication.purpose;
  const dosageFrequency =
    translation?.dosageFrequency ?? medication.dosageFrequency;

  // Compose text content for TTS
  const ttsTextContent = `${medication.medicationName}. ${purpose}. ${dosageFrequency}`;

  // Check Web Speech API support
  const isTtsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <section
      aria-label="Medication result"
      className="flex flex-col gap-4 w-full"
    >
      {/* Low confidence warning banner */}
      {showWarning && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-300"
        >
          <AlertTriangle
            className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-amber-800 text-base font-medium leading-snug">
            Please verify these details with your pharmacist
          </p>
        </div>
      )}

      {/* Medication information */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-white border border-gray-200">
        {/* Medication name — always shown in original form */}
        <h2
          className="font-bold text-gray-900 leading-tight"
          style={{ fontSize: "20px" }}
        >
          {medication.medicationName}
        </h2>

        {/* Purpose */}
        <div>
          <span className="block text-sm text-gray-500 mb-0.5">Purpose</span>
          <p
            className="text-gray-800 leading-snug"
            style={{ fontSize: "18px" }}
          >
            {purpose}
          </p>
        </div>

        {/* Dosage frequency */}
        <div>
          <span className="block text-sm text-gray-500 mb-0.5">
            Dosage &amp; Frequency
          </span>
          <p
            className="text-gray-800 leading-snug"
            style={{ fontSize: "18px" }}
          >
            {dosageFrequency}
          </p>
        </div>
      </div>

      {/* TTS Read Aloud controls */}
      <TTSControls
        textContent={ttsTextContent}
        language={language}
        isSupported={isTtsSupported}
      />
    </section>
  );
}
