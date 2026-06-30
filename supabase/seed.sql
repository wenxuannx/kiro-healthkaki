-- Seed data for subsidy_schemes table
-- Singapore government medical subsidy schemes with multilingual translations

-- Pioneer Generation Package
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'Pioneer Generation Package', 'pioneer',
  NULL, 1949,
  ARRAY['public_hospital', 'polyclinic'],
  ARRAY['E11', 'E14', 'I10', 'I25', 'I63', 'J45', 'E78', 'C34', 'C50', 'C61', 'N18', 'M81'],
  ARRAY['diabetes', 'hypertension', 'high blood pressure', 'heart disease', 'stroke', 'asthma', 'hyperlipidaemia', 'cholesterol', 'cancer', 'kidney disease', 'osteoporosis'],
  'Up to 75% discount on outpatient care at polyclinics and public specialist clinics. Additional subsidies for hospitalisation and MediShield Life premiums.',
  'Singapore citizen born on or before 31 December 1949 who obtained citizenship on or before 31 December 1986.',
  75,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "建国一代配套",
      "coverage_description": "综合诊疗所和公共专科诊所门诊护理可享高达75%折扣。住院和终身健保保费另有额外补贴。",
      "eligibility_conditions": "新加坡公民，1949年12月31日或之前出生，并于1986年12月31日或之前获得公民权。"
    },
    "ms-MY": {
      "scheme_name": "Pakej Generasi Perintis",
      "coverage_description": "Diskaun sehingga 75% untuk rawatan pesakit luar di poliklinik dan klinik pakar awam. Subsidi tambahan untuk kemasukan hospital dan premium MediShield Life.",
      "eligibility_conditions": "Warganegara Singapura yang lahir pada atau sebelum 31 Disember 1949 dan memperoleh kewarganegaraan pada atau sebelum 31 Disember 1986."
    },
    "ta-IN": {
      "scheme_name": "முன்னோடி தலைமுறை தொகுப்பு",
      "coverage_description": "பாலிகிளினிக்குகள் மற்றும் பொது நிபுணர் கிளினிக்குகளில் வெளிநோயாளி சிகிச்சைக்கு 75% வரை தள்ளுபடி. மருத்துவமனை அனுமதி மற்றும் மெடிஷீல்ட் லைஃப் பிரீமியத்திற்கு கூடுதல் மானியங்கள்.",
      "eligibility_conditions": "1949 டிசம்பர் 31 அல்லது அதற்கு முன் பிறந்த மற்றும் 1986 டிசம்பர் 31 அல்லது அதற்கு முன் குடியுரிமை பெற்ற சிங்கப்பூர் குடிமகன்."
    }
  }'::jsonb
);

-- Merdeka Generation Package
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'Merdeka Generation Package', 'merdeka',
  1950, 1959,
  ARRAY['public_hospital', 'polyclinic'],
  ARRAY['E11', 'E14', 'I10', 'I25', 'I63', 'J45', 'E78', 'C34', 'C50', 'C61', 'N18', 'M81'],
  ARRAY['diabetes', 'hypertension', 'high blood pressure', 'heart disease', 'stroke', 'asthma', 'hyperlipidaemia', 'cholesterol', 'cancer', 'kidney disease', 'osteoporosis'],
  'Up to 60% discount on outpatient care at polyclinics and public specialist clinics. Additional subsidies for hospitalisation and MediShield Life premiums.',
  'Singapore citizen born between 1 January 1950 and 31 December 1959 who obtained citizenship on or before 31 December 1996.',
  60,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "立国一代配套",
      "coverage_description": "综合诊疗所和公共专科诊所门诊护理可享高达60%折扣。住院和终身健保保费另有额外补贴。",
      "eligibility_conditions": "新加坡公民，1950年1月1日至1959年12月31日之间出生，并于1996年12月31日或之前获得公民权。"
    },
    "ms-MY": {
      "scheme_name": "Pakej Generasi Merdeka",
      "coverage_description": "Diskaun sehingga 60% untuk rawatan pesakit luar di poliklinik dan klinik pakar awam. Subsidi tambahan untuk kemasukan hospital dan premium MediShield Life.",
      "eligibility_conditions": "Warganegara Singapura yang lahir antara 1 Januari 1950 dan 31 Disember 1959 dan memperoleh kewarganegaraan pada atau sebelum 31 Disember 1996."
    },
    "ta-IN": {
      "scheme_name": "மெர்டேக்கா தலைமுறை தொகுப்பு",
      "coverage_description": "பாலிகிளினிக்குகள் மற்றும் பொது நிபுணர் கிளினிக்குகளில் வெளிநோயாளி சிகிச்சைக்கு 60% வரை தள்ளுபடி. மருத்துவமனை அனுமதி மற்றும் மெடிஷீல்ட் லைஃப் பிரீமியத்திற்கு கூடுதல் மானியங்கள்.",
      "eligibility_conditions": "1950 ஜனவரி 1 முதல் 1959 டிசம்பர் 31 வரை பிறந்த மற்றும் 1996 டிசம்பர் 31 அல்லது அதற்கு முன் குடியுரிமை பெற்ற சிங்கப்பூர் குடிமகன்."
    }
  }'::jsonb
);

-- CHAS Blue
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'CHAS Blue', 'chas_blue',
  NULL, NULL,
  ARRAY['polyclinic', 'gp_clinic'],
  ARRAY['E11', 'E14', 'I10', 'I25', 'J45', 'E78', 'J44', 'E05', 'N18', 'F32'],
  ARRAY['diabetes', 'hypertension', 'high blood pressure', 'asthma', 'hyperlipidaemia', 'cholesterol', 'copd', 'chronic obstructive pulmonary disease', 'thyroid', 'kidney disease', 'depression'],
  'Higher subsidies for chronic conditions at CHAS GP clinics. Up to $310 per visit for complex chronic conditions, $152.50 for simple chronic conditions.',
  'Singapore citizen living in a household with monthly income per person of $800 or below, or Annual Value of home $13,000 or below.',
  75,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "社保援助计划蓝卡",
      "coverage_description": "在社保援助计划全科诊所，慢性病可享更高补贴。复杂慢性病每次就诊最高可获$310补贴，简单慢性病最高$152.50。",
      "eligibility_conditions": "新加坡公民，家庭人均月收入$800或以下，或住所年值$13,000或以下。"
    },
    "ms-MY": {
      "scheme_name": "CHAS Biru",
      "coverage_description": "Subsidi lebih tinggi untuk keadaan kronik di klinik GP CHAS. Sehingga $310 setiap lawatan untuk keadaan kronik kompleks, $152.50 untuk keadaan kronik mudah.",
      "eligibility_conditions": "Warganegara Singapura yang tinggal dalam isi rumah dengan pendapatan bulanan per orang $800 atau ke bawah, atau Nilai Tahunan rumah $13,000 atau ke bawah."
    },
    "ta-IN": {
      "scheme_name": "CHAS நீலம்",
      "coverage_description": "CHAS GP கிளினிக்குகளில் நாள்பட்ட நோய்களுக்கு அதிக மானியங்கள். சிக்கலான நாள்பட்ட நோய்களுக்கு ஒரு வருகைக்கு $310 வரை, எளிய நாள்பட்ட நோய்களுக்கு $152.50.",
      "eligibility_conditions": "ஒரு நபருக்கு மாத வருமானம் $800 அல்லது அதற்கு கீழ், அல்லது வீட்டின் வருடாந்திர மதிப்பு $13,000 அல்லது அதற்கு கீழ் உள்ள குடும்பத்தில் வாழும் சிங்கப்பூர் குடிமகன்."
    }
  }'::jsonb
);


-- CHAS Orange
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'CHAS Orange', 'chas_orange',
  NULL, NULL,
  ARRAY['polyclinic', 'gp_clinic'],
  ARRAY['E11', 'E14', 'I10', 'I25', 'J45', 'E78', 'J44', 'E05', 'N18', 'F32'],
  ARRAY['diabetes', 'hypertension', 'high blood pressure', 'asthma', 'hyperlipidaemia', 'cholesterol', 'copd', 'chronic obstructive pulmonary disease', 'thyroid', 'kidney disease', 'depression'],
  'Subsidies for chronic conditions at CHAS GP clinics. Up to $205 per visit for complex chronic conditions, $82.50 for simple chronic conditions.',
  'Singapore citizen living in a household with monthly income per person of $801 to $1,200, or Annual Value of home $13,001 to $21,000.',
  45,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "社保援助计划橙卡",
      "coverage_description": "在社保援助计划全科诊所，慢性病可获补贴。复杂慢性病每次就诊最高可获$205补贴，简单慢性病最高$82.50。",
      "eligibility_conditions": "新加坡公民，家庭人均月收入$801至$1,200，或住所年值$13,001至$21,000。"
    },
    "ms-MY": {
      "scheme_name": "CHAS Oren",
      "coverage_description": "Subsidi untuk keadaan kronik di klinik GP CHAS. Sehingga $205 setiap lawatan untuk keadaan kronik kompleks, $82.50 untuk keadaan kronik mudah.",
      "eligibility_conditions": "Warganegara Singapura yang tinggal dalam isi rumah dengan pendapatan bulanan per orang $801 hingga $1,200, atau Nilai Tahunan rumah $13,001 hingga $21,000."
    },
    "ta-IN": {
      "scheme_name": "CHAS ஆரஞ்சு",
      "coverage_description": "CHAS GP கிளினிக்குகளில் நாள்பட்ட நோய்களுக்கு மானியங்கள். சிக்கலான நாள்பட்ட நோய்களுக்கு ஒரு வருகைக்கு $205 வரை, எளிய நாள்பட்ட நோய்களுக்கு $82.50.",
      "eligibility_conditions": "ஒரு நபருக்கு மாத வருமானம் $801 முதல் $1,200, அல்லது வீட்டின் வருடாந்திர மதிப்பு $13,001 முதல் $21,000 உள்ள குடும்பத்தில் வாழும் சிங்கப்பூர் குடிமகன்."
    }
  }'::jsonb
);

-- CHAS Green
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'CHAS Green', 'chas_green',
  NULL, NULL,
  ARRAY['polyclinic', 'gp_clinic'],
  ARRAY['E11', 'E14', 'I10', 'J45', 'E78', 'J44'],
  ARRAY['diabetes', 'hypertension', 'high blood pressure', 'asthma', 'hyperlipidaemia', 'cholesterol', 'copd', 'chronic obstructive pulmonary disease'],
  'Basic subsidies for chronic conditions at CHAS GP clinics. Up to $112.50 per visit for complex chronic conditions, $60 for simple chronic conditions.',
  'All Singapore citizens regardless of household income.',
  25,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "社保援助计划绿卡",
      "coverage_description": "在社保援助计划全科诊所，慢性病可获基本补贴。复杂慢性病每次就诊最高可获$112.50补贴，简单慢性病最高$60。",
      "eligibility_conditions": "所有新加坡公民，不论家庭收入。"
    },
    "ms-MY": {
      "scheme_name": "CHAS Hijau",
      "coverage_description": "Subsidi asas untuk keadaan kronik di klinik GP CHAS. Sehingga $112.50 setiap lawatan untuk keadaan kronik kompleks, $60 untuk keadaan kronik mudah.",
      "eligibility_conditions": "Semua warganegara Singapura tanpa mengira pendapatan isi rumah."
    },
    "ta-IN": {
      "scheme_name": "CHAS பச்சை",
      "coverage_description": "CHAS GP கிளினிக்குகளில் நாள்பட்ட நோய்களுக்கு அடிப்படை மானியங்கள். சிக்கலான நாள்பட்ட நோய்களுக்கு ஒரு வருகைக்கு $112.50 வரை, எளிய நாள்பட்ட நோய்களுக்கு $60.",
      "eligibility_conditions": "குடும்ப வருமானம் எதுவாக இருந்தாலும் அனைத்து சிங்கப்பூர் குடிமக்கள்."
    }
  }'::jsonb
);

-- MediSave CDMP (Chronic Disease Management Programme)
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'MediSave for Chronic Disease Management Programme', 'medisave_cdmp',
  NULL, NULL,
  ARRAY['public_hospital', 'polyclinic', 'gp_clinic'],
  ARRAY['E11', 'E14', 'I10', 'I11', 'E78', 'J45', 'J44', 'I63', 'I25', 'E05', 'N18', 'G40', 'F32', 'F33', 'M05', 'L40', 'K50', 'K51', 'G35', 'C00', 'C34', 'C50', 'C61', 'C18'],
  ARRAY['diabetes', 'hypertension', 'high blood pressure', 'hyperlipidaemia', 'cholesterol', 'asthma', 'copd', 'chronic obstructive pulmonary disease', 'stroke', 'heart disease', 'ischaemic heart disease', 'thyroid', 'kidney disease', 'epilepsy', 'depression', 'anxiety', 'rheumatoid arthritis', 'psoriasis', 'crohn', 'ulcerative colitis', 'multiple sclerosis', 'cancer'],
  'Use MediSave to pay for outpatient treatment of chronic conditions. Up to $700 per year for all CDMP conditions combined. Covers consultation, medication, and laboratory tests.',
  'Singapore citizen or Permanent Resident diagnosed with one or more CDMP-qualifying chronic conditions and receiving treatment at a CDMP-enrolled clinic.',
  50,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "保健储蓄慢性疾病管理计划",
      "coverage_description": "使用保健储蓄支付慢性病门诊治疗费用。所有慢性疾病管理计划病症合计每年最高$700。涵盖诊费、药物和化验。",
      "eligibility_conditions": "被诊断患有一种或多种慢性疾病管理计划合格慢性病的新加坡公民或永久居民，并在已注册诊所接受治疗。"
    },
    "ms-MY": {
      "scheme_name": "MediSave untuk Program Pengurusan Penyakit Kronik",
      "coverage_description": "Gunakan MediSave untuk membayar rawatan pesakit luar bagi keadaan kronik. Sehingga $700 setahun untuk semua keadaan CDMP digabungkan. Meliputi konsultasi, ubat-ubatan, dan ujian makmal.",
      "eligibility_conditions": "Warganegara Singapura atau Penduduk Tetap yang didiagnosis dengan satu atau lebih keadaan kronik yang layak CDMP dan menerima rawatan di klinik yang didaftarkan CDMP."
    },
    "ta-IN": {
      "scheme_name": "நாள்பட்ட நோய் மேலாண்மை திட்டத்திற்கான மெடிசேவ்",
      "coverage_description": "நாள்பட்ட நோய்களின் வெளிநோயாளி சிகிச்சைக்கு மெடிசேவ்-ஐ பயன்படுத்தவும். அனைத்து CDMP நோய்களுக்கும் ஆண்டுக்கு $700 வரை. ஆலோசனை, மருந்துகள் மற்றும் ஆய்வக சோதனைகள் உள்ளடக்கம்.",
      "eligibility_conditions": "ஒன்று அல்லது அதற்கு மேற்பட்ட CDMP தகுதியுள்ள நாள்பட்ட நோய்களால் கண்டறியப்பட்ட மற்றும் CDMP பதிவுசெய்யப்பட்ட கிளினிக்கில் சிகிச்சை பெறும் சிங்கப்பூர் குடிமகன் அல்லது நிரந்தர குடியுரிமையாளர்."
    }
  }'::jsonb
);


-- MediShield Life
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'MediShield Life', 'medishield_life',
  NULL, NULL,
  ARRAY['public_hospital'],
  ARRAY['E11', 'I10', 'I21', 'I25', 'I63', 'C34', 'C50', 'C61', 'C18', 'C71', 'N18', 'J44', 'K80', 'K35', 'S72', 'Z51'],
  ARRAY['diabetes', 'hypertension', 'heart attack', 'heart disease', 'stroke', 'cancer', 'kidney disease', 'kidney failure', 'dialysis', 'copd', 'gallstones', 'appendicitis', 'hip fracture', 'chemotherapy', 'radiotherapy', 'hospitalisation', 'hospitalization', 'surgery', 'day surgery'],
  'Universal health insurance covering large hospital bills and selected costly outpatient treatments such as dialysis and chemotherapy. Covers B2/C ward hospitalisation.',
  'All Singapore citizens and Permanent Residents are automatically covered under MediShield Life from birth.',
  65,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "终身健保",
      "coverage_description": "全民健康保险，涵盖大额住院费用和部分高费门诊治疗如透析和化疗。涵盖B2/C级病房住院费。",
      "eligibility_conditions": "所有新加坡公民和永久居民从出生起自动受终身健保保障。"
    },
    "ms-MY": {
      "scheme_name": "MediShield Life",
      "coverage_description": "Insurans kesihatan sejagat yang meliputi bil hospital besar dan rawatan pesakit luar terpilih yang mahal seperti dialisis dan kemoterapi. Meliputi kemasukan hospital wad B2/C.",
      "eligibility_conditions": "Semua warganegara Singapura dan Penduduk Tetap dilindungi secara automatik di bawah MediShield Life sejak lahir."
    },
    "ta-IN": {
      "scheme_name": "மெடிஷீல்ட் லைஃப்",
      "coverage_description": "பெரிய மருத்துவமனை கட்டணங்கள் மற்றும் டயாலிசிஸ் மற்றும் கீமோதெரபி போன்ற விலையுயர்ந்த வெளிநோயாளி சிகிச்சைகளை உள்ளடக்கிய உலகளாவிய சுகாதார காப்பீடு. B2/C வார்டு மருத்துவமனை அனுமதியை உள்ளடக்கும்.",
      "eligibility_conditions": "அனைத்து சிங்கப்பூர் குடிமக்கள் மற்றும் நிரந்தர குடியுரிமையாளர்கள் பிறப்பிலிருந்தே மெடிஷீல்ட் லைஃப் கீழ் தானாகவே பாதுகாக்கப்படுவர்."
    }
  }'::jsonb
);

-- MediFund
INSERT INTO subsidy_schemes (
  scheme_name, scheme_type,
  eligible_birth_year_min, eligible_birth_year_max,
  eligible_clinic_types, medical_codes, condition_keywords,
  coverage_description, eligibility_conditions,
  estimated_coverage_percent, translations
) VALUES (
  'MediFund', 'medifund',
  NULL, NULL,
  ARRAY['public_hospital', 'polyclinic'],
  ARRAY['E11', 'I10', 'I21', 'I25', 'I63', 'C34', 'C50', 'C61', 'C18', 'N18', 'J44', 'J45', 'S72', 'Z51', 'F20', 'F32', 'K80', 'K35'],
  ARRAY['diabetes', 'hypertension', 'heart attack', 'heart disease', 'stroke', 'cancer', 'kidney disease', 'kidney failure', 'dialysis', 'copd', 'asthma', 'hip fracture', 'chemotherapy', 'schizophrenia', 'depression', 'gallstones', 'appendicitis', 'hospitalisation', 'hospitalization', 'surgery'],
  'Safety net for patients who cannot afford their medical bills even after government subsidies and MediShield Life. Can cover up to 100% of remaining bill at public healthcare institutions.',
  'Singapore citizen who has difficulty paying for medical bills at public healthcare institutions after receiving government subsidies and using available MediShield Life and MediSave.',
  90,
  '{
    "cmn-Hans-CN": {
      "scheme_name": "保健基金",
      "coverage_description": "为无力支付医疗费用的患者提供的安全网，即使在政府补贴和终身健保之后仍无法负担者。可在公共医疗机构涵盖最高100%的剩余账单。",
      "eligibility_conditions": "在获得政府补贴并使用终身健保和保健储蓄后，仍难以支付公共医疗机构医疗费用的新加坡公民。"
    },
    "ms-MY": {
      "scheme_name": "MediFund",
      "coverage_description": "Jaringan keselamatan untuk pesakit yang tidak mampu membayar bil perubatan walaupun selepas subsidi kerajaan dan MediShield Life. Boleh menanggung sehingga 100% baki bil di institusi penjagaan kesihatan awam.",
      "eligibility_conditions": "Warganegara Singapura yang menghadapi kesukaran membayar bil perubatan di institusi penjagaan kesihatan awam selepas menerima subsidi kerajaan dan menggunakan MediShield Life dan MediSave yang ada."
    },
    "ta-IN": {
      "scheme_name": "மெடிஃபண்ட்",
      "coverage_description": "அரசு மானியங்கள் மற்றும் மெடிஷீல்ட் லைஃப்-க்குப் பிறகும் மருத்துவ கட்டணங்களை செலுத்த இயலாத நோயாளிகளுக்கான பாதுகாப்பு வலை. பொது சுகாதார நிறுவனங்களில் மீதமுள்ள கட்டணத்தில் 100% வரை செலுத்த முடியும்.",
      "eligibility_conditions": "அரசு மானியங்களைப் பெற்ற பின்னும் மெடிஷீல்ட் லைஃப் மற்றும் மெடிசேவ்-ஐ பயன்படுத்திய பின்னும் பொது சுகாதார நிறுவனங்களில் மருத்துவ கட்டணங்களை செலுத்துவதில் சிரமம் உள்ள சிங்கப்பூர் குடிமகன்."
    }
  }'::jsonb
);
