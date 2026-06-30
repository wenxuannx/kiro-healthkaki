"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import type { ProcessingStage } from "../types";

// --- Stage label mapping ---
const STAGE_LABELS: Record<ProcessingStage, string> = {
  uploading: "Uploading",
  reading: "Reading your document",
  finding: "Finding subsidies",
  scanning_medication: "Reading medication label",
};

// --- Props ---
interface ErrorDisplayProps {
  error: {
    message: string;
    instruction?: string;
    retryable: boolean;
    stage?: ProcessingStage;
    type?: string;
  };
  onRetry: () => void;
}

/**
 * ErrorDisplay component
 *
 * Displays error state with:
 * - Error icon and prominent message
 * - Optional instruction text for guidance
 * - Stage indicator showing which processing step failed
 * - "Try Again" button for retryable errors (44×44px touch target)
 * - Alternative guidance for non-retryable errors
 *
 * Validates: Requirements 1.8, 2.6, 2.10, 5.6, 8.5, 8.6
 */
export default function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center gap-4 p-6 rounded-2xl bg-red-50 border border-red-200"
    >
      {/* Error icon */}
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100">
        <AlertCircle className="w-7 h-7 text-red-600" aria-hidden="true" />
      </div>

      {/* Stage indicator */}
      {error.stage && (
        <p className="text-sm font-medium text-red-500">
          Error during: {STAGE_LABELS[error.stage]}
        </p>
      )}

      {/* Error message */}
      <h2 className="text-xl font-bold text-red-800 leading-snug">
        {error.message}
      </h2>

      {/* Optional instruction */}
      {error.instruction && (
        <p className="text-base text-neutral-700 leading-relaxed max-w-xs">
          {error.instruction}
        </p>
      )}

      {/* Action area */}
      {error.retryable ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRetry}
          className={cn(
            "mt-2 inline-flex items-center justify-center gap-2",
            "min-w-[44px] min-h-[44px] px-6 py-3",
            "rounded-full bg-blue-600 text-white font-semibold text-base",
            "shadow-md hover:bg-blue-700 active:bg-blue-800",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40"
          )}
          aria-label="Try again"
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          Try Again
        </motion.button>
      ) : (
        <p className="text-base text-neutral-600 leading-relaxed max-w-xs mt-2">
          Please try a different document, or visit your nearest Community Centre
          for assistance.
        </p>
      )}
    </motion.div>
  );
}
