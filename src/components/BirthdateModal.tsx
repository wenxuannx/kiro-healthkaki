"use client";

import { useState } from "react";

interface BirthdateModalProps {
  initialValue: string | null;
  onSave: (isoDate: string) => void;
  onClose: () => void;
}

export default function BirthdateModal({
  initialValue,
  onSave,
  onClose,
}: BirthdateModalProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const today = new Date().toISOString().slice(0, 10);

  const isValid = value !== "" && value <= today;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthdate-modal-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl p-6 space-y-4 shadow-lg"
      >
        <h2
          id="birthdate-modal-title"
          className="text-xl font-bold text-gray-900"
        >
          {initialValue ? "Edit Your Birthdate" : "What's Your Birthdate?"}
        </h2>
        <p className="text-base text-gray-600">
          We use this to find subsidies you&apos;re eligible for.
        </p>

        <div className="space-y-2">
          <label
            htmlFor="birthdate-input"
            className="block text-lg font-medium text-gray-900"
          >
            Birthdate
          </label>
          <input
            id="birthdate-input"
            type="date"
            value={value}
            max={today}
            onChange={(e) => setValue(e.target.value)}
            className="w-full min-h-[44px] px-4 py-3 text-lg border-2 border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            aria-required="true"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-6 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className="flex-1 min-h-[44px] px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
