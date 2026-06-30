CREATE TABLE subsidy_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_name TEXT NOT NULL,
  scheme_type TEXT NOT NULL CHECK (scheme_type IN (
    'pioneer', 'merdeka', 'chas_blue', 'chas_orange', 'chas_green',
    'medisave_cdmp', 'medishield_life', 'medifund'
  )),
  eligible_birth_year_min INTEGER,        -- NULL means no lower bound
  eligible_birth_year_max INTEGER,        -- NULL means no upper bound
  eligible_clinic_types TEXT[] NOT NULL,   -- e.g., {'public_hospital', 'polyclinic'}
  medical_codes TEXT[] NOT NULL DEFAULT '{}',       -- ICD-10/SNOMED codes
  condition_keywords TEXT[] NOT NULL DEFAULT '{}',  -- diagnosis keyword matches
  coverage_description TEXT NOT NULL,
  eligibility_conditions TEXT NOT NULL,
  estimated_coverage_percent INTEGER NOT NULL CHECK (
    estimated_coverage_percent >= 0 AND estimated_coverage_percent <= 100
  ),
  translations JSONB NOT NULL DEFAULT '{}',
  -- translations shape: { "cmn-Hans-CN": {...}, "ms-MY": {...}, "ta-IN": {...} }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for medical code lookups
CREATE INDEX idx_subsidy_schemes_medical_codes ON subsidy_schemes USING GIN (medical_codes);

-- Index for condition keyword lookups
CREATE INDEX idx_subsidy_schemes_condition_keywords ON subsidy_schemes USING GIN (condition_keywords);

-- Index for clinic type filtering
CREATE INDEX idx_subsidy_schemes_clinic_types ON subsidy_schemes USING GIN (eligible_clinic_types);
