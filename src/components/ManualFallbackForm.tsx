"use client";

import { useState } from "react";
import type { ManualInputData } from "../types";

interface ManualFallbackFormProps {
  onSubmit: (data: ManualInputData) => void;
  isProcessing: boolean;
}

const CLINIC_TYPES: {
  value: ManualInputData["clinicType"];
  label: string;
}[] = [
  { value: "public_hospital", label: "Public Hospital" },
  { value: "polyclinic", label: "Polyclinic" },
  { value: "gp_clinic", label: "GP Clinic" },
];

const CDMP_CONDITIONS = [
  "Diabetes",
  "Hypertension (High Blood Pressure)",
  "Hyperlipidaemia (High Cholesterol)",
  "Asthma",
  "COPD (Chronic Obstructive Pulmonary Disease)",
  "Stroke",
  "Heart Disease (Ischaemic Heart Disease)",
  "Kidney Disease (Chronic Kidney Disease)",
  "Epilepsy",
  "Depression",
  "Anxiety",
  "Rheumatoid Arthritis",
  "Osteoporosis",
];

export default function ManualFallbackForm({
  onSubmit,
  isProcessing,
}: ManualFallbackFormProps) {
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [clinicType, setClinicType] = useState<
    ManualInputData["clinicType"] | ""
  >("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);

  const currentYear = new Date().getFullYear();

  // Generate birth year options from current year down to 1920
  const birthYearOptions: number[] = [];
  for (let year = currentYear; year >= 1920; year--) {
    birthYearOptions.push(year);
  }

  const isFormValid = birthYear !== "" && clinicType !== "";

  const handleConditionToggle = (condition: string) => {
    setChronicConditions((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    onSubmit({
      birthYear: birthYear as number,
      clinicType: clinicType as ManualInputData["clinicType"],
      chronicConditions,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto p-6 space-y-6"
      aria-label="Manual subsidy information form"
    >
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Tell Us More
        </h2>
        <p className="text-lg text-gray-600 mt-2">
          We need a few more details to find your subsidies.
        </p>
      </div>

      {/* Birth Year Dropdown */}
      <div className="space-y-2">
        <label
          htmlFor="birth-year"
          className="block text-lg font-medium text-gray-900"
        >
          Year of Birth
        </label>
        <select
          id="birth-year"
          value={birthYear}
          onChange={(e) =>
            setBirthYear(e.target.value ? Number(e.target.value) : "")
          }
          className="w-full min-h-[44px] px-4 py-3 text-lg border-2 border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          aria-required="true"
        >
          <option value="">Select your birth year</option>
          {birthYearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Clinic Type Selector */}
      <div className="space-y-2">
        <label
          htmlFor="clinic-type"
          className="block text-lg font-medium text-gray-900"
        >
          Type of Clinic Visited
        </label>
        <select
          id="clinic-type"
          value={clinicType}
          onChange={(e) =>
            setClinicType(
              e.target.value as ManualInputData["clinicType"] | ""
            )
          }
          className="w-full min-h-[44px] px-4 py-3 text-lg border-2 border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          aria-required="true"
        >
          <option value="">Select clinic type</option>
          {CLINIC_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Chronic Condition Checkboxes */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-medium text-gray-900">
          Chronic Conditions (if any)
        </legend>
        <p className="text-base text-gray-500">
          Select any conditions you are being treated for.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto p-1">
          {CDMP_CONDITIONS.map((condition) => (
            <label
              key={condition}
              className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <input
                type="checkbox"
                checked={chronicConditions.includes(condition)}
                onChange={() => handleConditionToggle(condition)}
                className="w-6 h-6 min-w-[24px] min-h-[24px] rounded border-2 border-gray-400 text-blue-600 focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-lg text-gray-800">{condition}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isFormValid || isProcessing}
        className="w-full min-h-[44px] px-6 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
        aria-busy={isProcessing}
      >
        {isProcessing ? "Finding Your Subsidies..." : "Find My Subsidies"}
      </button>
    </form>
  );
}
