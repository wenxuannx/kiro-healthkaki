"use client";

import type { SubsidyResult, SupportedLanguage } from "../types";

interface SubsidyCardProps {
  subsidy: SubsidyResult;
  language: SupportedLanguage;
}

/**
 * Displays a single subsidy scheme as a card with:
 * - Scheme name (24px heading)
 * - Coverage description (18px body)
 * - Eligibility conditions (18px body)
 * - Estimated coverage percent (prominent badge)
 *
 * Supports multilingual display with English fallback.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.5, 6.7
 */
export default function SubsidyCard({ subsidy, language }: SubsidyCardProps) {
  // Use translation for the selected language if available; fall back to English fields
  const translation = subsidy.translations[language];
  const schemeName = translation?.schemeName ?? subsidy.schemeName;
  const coverageDescription =
    translation?.coverageDescription ?? subsidy.coverageDescription;
  const eligibilityConditions =
    translation?.eligibilityConditions ?? subsidy.eligibilityConditions;

  return (
    <article
      className="rounded-xl border border-neutral-200 bg-white shadow-sm p-5 flex flex-col gap-4"
      aria-label={`Subsidy scheme: ${schemeName}`}
    >
      {/* Header row: scheme name + coverage badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-2xl font-bold text-neutral-900 leading-tight">
          {schemeName}
        </h3>
        <span
          className="inline-flex items-center justify-center shrink-0 rounded-full bg-emerald-600 text-white font-bold text-lg min-w-[56px] h-[56px] px-2"
          aria-label={`Estimated coverage: ${subsidy.estimatedCoveragePercent} percent`}
        >
          {subsidy.estimatedCoveragePercent}%
        </span>
      </div>

      {/* Coverage description */}
      <div>
        <p className="text-lg font-semibold text-neutral-700 mb-1">
          Coverage
        </p>
        <p className="text-lg text-neutral-800 leading-relaxed">
          {coverageDescription}
        </p>
      </div>

      {/* Eligibility conditions */}
      <div>
        <p className="text-lg font-semibold text-neutral-700 mb-1">
          Eligibility
        </p>
        <p className="text-lg text-neutral-800 leading-relaxed">
          {eligibilityConditions}
        </p>
      </div>
    </article>
  );
}
