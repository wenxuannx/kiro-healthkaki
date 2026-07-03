"use client";

import { AlertTriangle } from "lucide-react";

interface HandwritingWarningProps {
  onRetry: () => void;
  onCancel: () => void;
}

/**
 * Safety warning displayed when handwriting is detected on a medication label.
 * Rejects the submission and instructs the user to scan only official printed labels.
 *
 * Requirements: 9.6, 9.7
 */
export default function HandwritingWarning({
  onRetry,
  onCancel,
}: HandwritingWarningProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 text-center shadow-md"
    >
      {/* Warning icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden="true" />
      </div>

      {/* Bold safety message */}
      <h2 className="text-[24px] font-bold leading-tight text-amber-900">
        Handwritten Label Detected
      </h2>

      {/* Explanation */}
      <p className="text-[18px] leading-relaxed text-amber-800">
        Handwritten labels cannot be accepted because misread handwriting may
        lead to incorrect medication information.
      </p>

      {/* Instruction */}
      <p className="text-[18px] leading-relaxed text-amber-700">
        Please scan only official printed labels from the pharmacy or
        manufacturer.
      </p>

      {/* Action buttons */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-amber-600 px-6 py-3 text-[18px] font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/40"
        >
          Try Again
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-amber-300 bg-white px-6 py-3 text-[18px] font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
