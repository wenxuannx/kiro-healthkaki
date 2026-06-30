# Implementation Plan: SubsidyKaki Subsidy Checker

## Overview

This plan implements the SubsidyKaki stateless document processing pipeline and UI. The existing Gemini wrapper (`src/lib/gemini.ts`), Supabase clients (`src/lib/supabase/client.ts`, `server.ts`) are already in place. Tasks cover new modules, Supabase schema, client components, API route rewrite, page integration, and tests.

## Tasks

- [ ] 1. Define TypeScript types and error classes
  - [ ] 1.1 Create shared type definitions at `src/types/index.ts`
    - Define `SupportedLanguage`, `ProcessingStage`, `SubsidyResult`, `SubsidyScheme`, `ExtractedDocumentData`, `RedactedExtractedData`, `RawExtractedData`, `RedactionResult`, `SubsidyLookupParams`, `SubsidyLookupResult`, `ManualInputData`, `ProcessDocumentResponse`, `AppState` interfaces/types
    - Define `SubsidyKakiError`, `NricRedactionError`, `OcrExtractionError`, `SubsidyLookupError`, `FileValidationError`, `TimeoutError` error classes
    - _Requirements: 2.7, 3.1, 5.3, 6.5_

- [ ] 2. Implement NRIC redaction module
  - [ ] 2.1 Create `src/lib/nric-redactor.ts`
    - Implement `FULL_NRIC_PATTERN`, `PARTIAL_NRIC_PATTERN`, and `ALL_NRIC_PATTERN` regex constants
    - Implement `redactNric(text: string): RedactionResult` with fail-closed semantics
    - Implement `redactExtractedData(data: RawExtractedData): RedactedExtractedData` that applies redaction to all string fields
    - Throw `NricRedactionError` on any error (null input, regex failure, remaining patterns after redaction)
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [ ]* 2.2 Write property test for NRIC redaction completeness
    - **Property 4: NRIC Redaction Completeness**
    - Generate random strings with embedded NRIC patterns; verify zero NRIC patterns remain after redaction and correct `[REDACTED]` count
    - **Validates: Requirements 3.1, 3.2, 3.5**

  - [ ]* 2.3 Write property test for NRIC redaction fail-closed
    - **Property 5: NRIC Redaction Fail-Closed**
    - Generate adversarial inputs (null, undefined, special characters); verify `NricRedactionError` is thrown rather than returning unredacted text
    - **Validates: Requirements 3.6**

  - [ ]* 2.4 Write unit tests for NRIC redactor
    - Test known NRIC formats (S1234567A, T9876543Z), case variations, partial NRICs, NRICs embedded in sentences, multiple NRICs in one string, empty string input
    - Create test file at `src/lib/__tests__/nric-redactor.test.ts`
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [ ] 3. Implement file validation module
  - [ ] 3.1 Create `src/lib/file-validator.ts`
    - Implement `validateFile(file: File): { valid: boolean; error?: string }` that checks MIME type against allowed list and file size ≤ 10MB
    - Implement PDF page count validation (≤ 5 pages) — parse PDF header or use lightweight check
    - Return descriptive error messages per the API error response spec
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.10, 2.9_

  - [ ]* 3.2 Write property test for file validation
    - **Property 1: File Validation Correctness**
    - Generate random MIME types and file sizes; verify acceptance iff MIME ∈ {image/jpeg, image/png, image/webp, image/heic, application/pdf} AND size ≤ 10MB
    - **Validates: Requirements 1.2, 1.4, 1.5, 2.9**

  - [ ]* 3.3 Write unit tests for file validator
    - Test boundary cases: exactly 10MB, 10MB + 1 byte, 5-page PDF, 6-page PDF, each allowed/disallowed MIME type
    - Create test file at `src/lib/__tests__/file-validator.test.ts`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.10_

- [ ] 4. Implement OCR pipeline module
  - [ ] 4.1 Create `src/lib/ocr-pipeline.ts`
    - Implement `processDocument(fileBuffer: ArrayBuffer, mimeType: string): Promise<{ extracted: RedactedExtractedData }>` that sends base64 image to Gemini with extraction prompt, parses JSON response, applies NRIC redaction, and returns structured data
    - Handle Gemini response parsing with fallback for malformed JSON
    - Ensure image data is discarded after Gemini response (stateless)
    - Detect empty extraction (all fields null/empty) and throw `OcrExtractionError`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.11, 3.3, 4.1, 4.2_

  - [ ]* 4.2 Write property test for OCR response parsing
    - **Property 2: OCR Response Parsing Produces Valid Structure**
    - Generate random JSON strings with expected fields; verify parsed output matches type constraints (arrays are arrays, nulls are null, strings are strings)
    - **Validates: Requirements 2.7, 2.11**

  - [ ]* 4.3 Write property test for empty extraction detection
    - **Property 3: Empty Extraction Detection**
    - Generate extraction results where all of medicalCodes, diagnoses, visitDate, institution are empty/null; verify system classifies as failed extraction
    - **Validates: Requirements 2.6**

  - [ ]* 4.4 Write unit tests for OCR pipeline
    - Test Gemini response parsing (valid JSON, JSON wrapped in markdown code fences, malformed JSON), empty extraction detection, NRIC redaction integration
    - Mock `geminiModel.generateContent` via Vitest
    - Create test file at `src/lib/__tests__/ocr-pipeline.test.ts`
    - _Requirements: 2.1, 2.6, 2.7, 2.11, 4.1, 4.2_

- [ ] 5. Implement subsidy lookup service
  - [ ] 5.1 Create `src/lib/subsidy-lookup.ts`
    - Implement `lookupSubsidies(params: SubsidyLookupParams): Promise<SubsidyLookupResult>` that queries Supabase `subsidy_schemes` table matching on medical_codes OR condition_keywords overlap, filtered by institution clinic type mapping
    - Implement `filterByBirthYear(schemes: SubsidyScheme[], birthYear: number | undefined): SubsidyScheme[]` for age-gated scheme filtering
    - Return `{ subsidies: [], message: "Insufficient data", needsManualInput: true }` when no codes/diagnoses provided
    - Map institution name to clinic type category (public_hospital, polyclinic, gp_clinic)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [ ]* 5.2 Write property test for subsidy query decision logic
    - **Property 6: Subsidy Query Decision Logic**
    - Generate random medicalCodes/diagnoses arrays; verify query executes iff at least one non-empty entry exists, otherwise returns insufficient data message
    - **Validates: Requirements 5.1, 5.7**

  - [ ]* 5.3 Write property test for subsidy lookup completeness
    - **Property 7: Subsidy Lookup Completeness and Filtering**
    - Generate random subsidy scheme sets and queries; verify every scheme whose codes/keywords overlap AND clinic type matches is included in results
    - **Validates: Requirements 5.2, 5.5**

  - [ ]* 5.4 Write unit tests for subsidy lookup
    - Test specific scheme matching scenarios, birth year filtering (Pioneer <1950, Merdeka 1950-1959), institution mapping, empty results message
    - Mock Supabase client via Vitest
    - Create test file at `src/lib/__tests__/subsidy-lookup.test.ts`
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.7_

- [ ] 6. Checkpoint - Core modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Create Supabase schema and seed data
  - [ ] 7.1 Create migration file for `subsidy_schemes` table
    - Create `supabase/migrations/001_create_subsidy_schemes.sql` with full schema including UUID PK, all columns, CHECK constraints, GIN indexes on medical_codes, condition_keywords, and eligible_clinic_types — copy the exact CREATE TABLE SQL from design.md as the source of truth
    - _Requirements: 5.1, 5.2_

  - [ ] 7.2 Create seed data file with Singapore subsidy schemes
    - Create `supabase/seed.sql` with INSERT statements for Pioneer Generation, Merdeka Generation, CHAS Blue/Orange/Green, MediSave CDMP, MediShield Life, and MediFund schemes
    - Include translations for cmn-Hans-CN, ms-MY, and ta-IN where available
    - Include representative medical_codes and condition_keywords for each scheme
    - _Requirements: 5.2, 6.5_

- [ ] 8. Implement client components
  - [ ] 8.1 Create `src/components/LanguageToggle.tsx`
    - Four-option toggle: English | 中文 | Melayu | தமிழ்
    - 44×44px minimum touch targets per option
    - Accept `current` and `onChange` props per design interface
    - _Requirements: 6.5, 7.9_

  - [ ] 8.2 Create `src/components/SubsidyCard.tsx`
    - Display single subsidy scheme: name, coverage description, eligibility conditions, estimated coverage percent
    - Support multilingual display with English fallback
    - 18px body text, 24px headings, WCAG AA contrast
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7_

  - [ ] 8.3 Create `src/components/ResultsDisplay.tsx`
    - Render subsidy cards ordered by `estimatedCoveragePercent` descending
    - Summary count at top showing number of applicable schemes
    - Accept `subsidies`, `language`, and `extractedData` props
    - Fall back to English if translation unavailable for selected language
    - _Requirements: 6.1, 6.4, 6.5, 6.7_

  - [ ] 8.4 Create `src/components/TTSControls.tsx`
    - States: idle | playing | paused
    - Read Aloud, Pause, Stop buttons (44×44px touch targets)
    - Use Web Speech API with rate 0.7–0.75x
    - Language-aware voice selection (en-SG, cmn-Hans-CN, ms-MY, ta-IN)
    - Highlight currently spoken segment
    - Hide entirely if Web Speech API unsupported
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [ ] 8.5 Create `src/components/DocumentCapture.tsx`
    - States: idle | preview | submitting | error
    - Camera button + file upload button
    - Image preview with confirm/retake
    - Accept JPEG, PNG, WebP, HEIC, PDF (≤10MB)
    - Disable camera button if permission denied/unavailable
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [ ] 8.6 Create `src/components/LoadingProgress.tsx`
    - Display stage-specific animated indicator with text per stage (uploading, reading, finding)
    - Auto-trigger `onTimeout` callback after configurable timeout (default 30s)
    - Minimum 48px width/height for indicator
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 8.7 Create `src/components/ManualFallbackForm.tsx`
    - Birth year dropdown (1920–current year)
    - Clinic type selector (public_hospital, polyclinic, gp_clinic)
    - Chronic condition checkboxes (CDMP list)
    - Submit handler calls API with manual data
    - _Requirements: 2.12_

  - [ ] 8.8 Create `src/components/ErrorDisplay.tsx`
    - Display error message with "Try Again" button (44×44px)
    - Distinguish retryable vs non-retryable errors
    - Show which processing stage failed
    - _Requirements: 1.8, 2.6, 2.10, 5.6, 8.5, 8.6_

- [ ] 9. Checkpoint - Components complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Rewrite API route to stateless architecture
  - [ ] 10.1 Replace `src/app/api/process-document/route.ts` with stateless implementation
    - Remove all Supabase Storage upload logic
    - Remove all `document_submissions` database persistence
    - Integrate file validation module, OCR pipeline, NRIC redaction, and subsidy lookup
    - Accept optional `birthYear`, `clinicType`, `chronicConditions` form fields for manual fallback
    - Return `ProcessDocumentResponse` shape: `{ extracted, subsidies, message, needsManualInput }`
    - Return appropriate error codes: 400 (validation), 500 (privacy/extraction/lookup), 504 (timeout)
    - Ensure image data is discarded after processing (stateless)
    - _Requirements: 2.9, 3.3, 3.6, 4.1, 4.2, 4.3, 5.1, 5.6, 5.7_

  - [ ]* 10.2 Write integration tests for the API route
    - Mock Gemini API responses, use test Supabase data
    - Test full pipeline: valid image → extraction → redaction → subsidy lookup → response
    - Test error cases: invalid file type, oversized file, privacy failure, timeout
    - Create test file at `src/app/api/process-document/__tests__/route.integration.test.ts`
    - _Requirements: 2.9, 3.6, 4.1, 5.1_

- [ ] 11. Rewrite main page with component integration
  - [ ] 11.1 Create `src/app/check/page.tsx` as the dedicated SubsidyKaki flow page (do NOT replace the existing landing page at `src/app/page.tsx`)
    - Implement `AppState` management (capture → processing → results → error → manual-input stages)
    - Wire DocumentCapture → API submission → LoadingProgress → ResultsDisplay flow
    - Integrate LanguageToggle (client-side state), TTSControls, ManualFallbackForm, ErrorDisplay
    - Handle retry (retain file in memory, no re-upload needed)
    - Responsive layout with accessibility: 18px body, 24px headings, 44×44px touch targets
    - _Requirements: 1.1, 1.7, 1.8, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.9, 8.1, 8.2, 8.3, 8.5, 8.6_

- [ ] 12. Property tests for UI correctness
  - [ ]* 12.1 Write property test for results ordering
    - **Property 8: Results Ordering by Coverage**
    - Generate random SubsidyResult arrays; verify displayed order is descending by `estimatedCoveragePercent`
    - Create test file at `src/components/__tests__/results-display.property.test.ts`
    - **Validates: Requirements 6.1**

  - [ ]* 12.2 Write property test for language fallback
    - **Property 9: Language Display with English Fallback**
    - Generate random SubsidyResult × SupportedLanguage combinations; verify translation used when available, English fallback when null, no empty display fields
    - Create test file at `src/components/__tests__/results-display.property.test.ts`
    - **Validates: Requirements 6.5, 6.7**

  - [ ]* 12.3 Write property test for TTS configuration
    - **Property 10: TTS Configuration Correctness**
    - For all 4 SupportedLanguage values, verify SpeechSynthesisUtterance rate ∈ [0.7, 0.75] and lang matches expected locale code
    - Create test file at `src/components/__tests__/tts-controls.property.test.ts`
    - **Validates: Requirements 7.3, 7.9**

  - [ ]* 12.4 Write unit tests for client components
    - Test DocumentCapture (file selection, preview, error states), LoadingProgress (stage transitions, timeout), ResultsDisplay (0/1/many results), TTSControls (Web Speech API unavailable), ManualFallbackForm (validation)
    - Create test files under `src/components/__tests__/`
    - _Requirements: 1.1, 1.6, 6.1, 7.7, 8.1_

- [ ] 13. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Existing files (`src/lib/gemini.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`) are NOT modified — new modules import from them
- Tasks 10.1 and 11.1 fully replace existing file contents (not incremental edits) to align with the stateless design architecture
- Vitest and fast-check need to be installed as dev dependencies before running tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "7.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "4.1", "5.1", "7.2"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.2", "5.3", "5.4"] },
    { "id": 4, "tasks": ["8.1", "8.2", "8.6", "8.7", "8.8"] },
    { "id": 5, "tasks": ["8.3", "8.4", "8.5"] },
    { "id": 6, "tasks": ["10.1", "11.1"] },
    { "id": 7, "tasks": ["10.2", "12.1", "12.2", "12.3", "12.4"] }
  ]
}
```
