// Richer, human-written detail for each subsidy scheme's Details screen —
// keyed by subsidy_schemes.id. This is fixed policy information (what the
// scheme covers, how to actually use it) that doesn't vary per document
// lookup, so it lives here as static content rather than a DB column.
// Sourced from chas.sg, moh.gov.sg/managing-expenses/schemes-and-subsidies,
// and the Pioneer/Merdeka Generation Package pages on
// supportgowhere.life.gov.sg / moh.gov.sg.
// Schemes not listed here fall back to the generic description-derived text
// in Results.tsx's toSubsidyCard.
import type { Language } from "@/types";

export interface SubsidyDetail {
  benefits: string[];
  howToUse: string;
}

type LocalizedDetail = Record<Language, SubsidyDetail>;

// Pioneer Generation's MediShield Life premium subsidy rises with age
// ("age next birthday" bands per MOH Table E). Merdeka's rises from 5% to
// 10% once a member turns 76. Both packages also pay an age-banded MediSave
// top-up (Pioneer only). These are the only two schemes whose real-world
// benefit amount actually changes with birth year, so their detail is
// computed rather than static.
function pioneerDetail(birthYear: number | undefined): LocalizedDetail {
  const currentYear = new Date().getFullYear();
  const age = birthYear !== undefined ? currentYear - birthYear : undefined;

  const medishieldSubsidy =
    age === undefined
      ? "40%–60%"
      : age <= 70
        ? "40%"
        : age <= 80
          ? "44%–54%"
          : age <= 90
            ? "54%–59%"
            : "60%";
  const medishieldSubsidyQualifier =
    age === undefined
      ? {
          en: ", depending on your age",
          zh: "，具体取决于您的年龄",
          ms: ", bergantung kepada umur anda",
          ta: ", உங்கள் வயதைப் பொறுத்து",
        }
      : { en: "", zh: "", ms: "", ta: "" };

  const topUp =
    birthYear === undefined
      ? "$300–$1,200"
      : birthYear <= 1934
        ? "$1,200"
        : birthYear <= 1939
          ? "$700"
          : birthYear <= 1944
            ? "$500"
            : "$300";
  const topUpPeriodQualifier =
    birthYear === undefined
      ? {
          en: " a year, depending on your birth year",
          zh: "，每年发放，具体金额取决于您的出生年份",
          ms: " setahun, bergantung kepada tahun kelahiran anda",
          ta: " ஆண்டுக்கு, உங்கள் பிறந்த ஆண்டைப் பொறுத்து",
        }
      : {
          en: " a year",
          zh: "，每年发放",
          ms: " setahun",
          ta: " ஆண்டுக்கு",
        };

  return {
    en: {
      benefits: [
        `MediShield Life premium subsidy of ${medishieldSubsidy} of your annual premium${medishieldSubsidyQualifier.en}`,
        "An extra 50% off your remaining bill for subsidised services and medications at polyclinics and public Specialist Outpatient Clinics",
        "Higher CHAS-equivalent subsidies at participating GP and dental clinics (up to $28.50 for common illnesses, $90–$135 for chronic conditions)",
        `Automatic MediSave top-up of ${topUp}${topUpPeriodQualifier.en} for life`,
      ],
      howToUse:
        "Your Pioneer Generation status is linked to your NRIC — simply present your NRIC at any CHAS clinic, polyclinic, or public hospital and the subsidy is applied automatically at the point of payment. No application is needed.",
    },
    zh: {
      benefits: [
        `您的终身健保（MediShield Life）年度保费可获${medishieldSubsidy}补贴${medishieldSubsidyQualifier.zh}`,
        "在综合诊疗所及公立专科门诊，剩余账单的受津贴服务与药物再享额外50%折扣",
        "在参与计划的普通科及牙科诊所享有更高的CHAS等值津贴（常见疾病最高$28.50，慢性疾病$90至$135）",
        `终身自动获得${topUp}${topUpPeriodQualifier.zh}的保健储蓄户头（MediSave）补助`,
      ],
      howToUse:
        "您的建国一代身份与您的身份证号码绑定——只需在任何CHAS诊所、综合诊疗所或公立医院出示身份证，津贴即会在付款时自动扣除，无需另行申请。",
    },
    ms: {
      benefits: [
        `Subsidi premium MediShield Life sebanyak ${medishieldSubsidy} daripada premium tahunan anda${medishieldSubsidyQualifier.ms}`,
        "Tambahan 50% diskaun untuk baki bil bagi perkhidmatan dan ubat bersubsidi di poliklinik dan Klinik Pakar Luar (SOC) awam",
        "Subsidi setaraf CHAS yang lebih tinggi di klinik GP dan pergigian yang mengambil bahagian (sehingga $28.50 untuk penyakit biasa, $90–$135 untuk keadaan kronik)",
        `Tambahan automatik MediSave sebanyak ${topUp}${topUpPeriodQualifier.ms} seumur hidup`,
      ],
      howToUse:
        "Status Generasi Pioneer anda dikaitkan dengan NRIC anda — cuma tunjukkan NRIC anda di mana-mana klinik CHAS, poliklinik, atau hospital awam dan subsidi akan digunakan secara automatik semasa pembayaran. Tiada permohonan diperlukan.",
    },
    ta: {
      benefits: [
        `உங்கள் ஆண்டு MediShield Life பிரீமியத்தில் ${medishieldSubsidy} மானியம்${medishieldSubsidyQualifier.ta}`,
        "பாலிக்ளினிக்குகள் மற்றும் பொது சிறப்பு வெளிநோயாளர் மருத்துவமனைகளில் மானியம் பெறும் சேவைகள் மற்றும் மருந்துகளுக்கான மீதமுள்ள பில்லில் கூடுதலாக 50% தள்ளுபடி",
        "பங்கேற்கும் GP மற்றும் பல் மருத்துவ கிளினிக்குகளில் அதிக CHAS-சமமான மானியங்கள் (பொதுவான நோய்களுக்கு $28.50 வரை, நீண்டகால நோய்களுக்கு $90–$135)",
        `வாழ்நாள் முழுவதும் தானியங்கு ${topUp}${topUpPeriodQualifier.ta} MediSave கூடுதல் தொகை`,
      ],
      howToUse:
        "உங்கள் Pioneer Generation நிலை உங்கள் NRIC உடன் இணைக்கப்பட்டுள்ளது — எந்த CHAS கிளினிக், பாலிக்ளினிக் அல்லது அரசு மருத்துவமனையிலும் உங்கள் NRIC-ஐ காட்டினால் போதும், கட்டணம் செலுத்தும் போது மானியம் தானாகவே பயன்படுத்தப்படும். விண்ணப்பிக்க தேவையில்லை.",
    },
  };
}

function merdekaDetail(birthYear: number | undefined): LocalizedDetail {
  const currentYear = new Date().getFullYear();
  const age = birthYear !== undefined ? currentYear - birthYear : undefined;

  const medishieldSubsidy =
    age === undefined ? "5%" : age >= 76 ? "10%" : "5%";
  const medishieldSubsidyQualifier =
    age === undefined
      ? {
          en: " (10% from age 76)",
          zh: "（76岁起为10%）",
          ms: " (10% dari umur 76)",
          ta: " (76 வயதிலிருந்து 10%)",
        }
      : { en: "", zh: "", ms: "", ta: "" };

  return {
    en: {
      benefits: [
        `MediShield Life premium subsidy of ${medishieldSubsidy} of your annual premium${medishieldSubsidyQualifier.en}`,
        "An extra 25% off your remaining bill for subsidised services and medications at polyclinics and public Specialist Outpatient Clinics",
        "Higher CHAS-equivalent subsidies at participating GP and dental clinics (up to $23.50 for common illnesses, $85–$130 for chronic conditions)",
        "$2 fixed screening fee under Healthier SG if you're not yet enrolled",
      ],
      howToUse:
        "Present your NRIC at a CHAS clinic, polyclinic, or public hospital — the subsidy is deducted from your bill automatically. No separate application is required.",
    },
    zh: {
      benefits: [
        `您的终身健保（MediShield Life）年度保费可获${medishieldSubsidy}补贴${medishieldSubsidyQualifier.zh}`,
        "在综合诊疗所及公立专科门诊，剩余账单的受津贴服务与药物再享额外25%折扣",
        "在参与计划的普通科及牙科诊所享有更高的CHAS等值津贴（常见疾病最高$23.50，慢性疾病$85至$130）",
        "若尚未加入健康SG（Healthier SG）计划，体检费用固定为$2",
      ],
      howToUse:
        "在CHAS诊所、综合诊疗所或公立医院出示身份证，津贴即会自动从账单中扣除，无需另行申请。",
    },
    ms: {
      benefits: [
        `Subsidi premium MediShield Life sebanyak ${medishieldSubsidy} daripada premium tahunan anda${medishieldSubsidyQualifier.ms}`,
        "Tambahan 25% diskaun untuk baki bil bagi perkhidmatan dan ubat bersubsidi di poliklinik dan Klinik Pakar Luar (SOC) awam",
        "Subsidi setaraf CHAS yang lebih tinggi di klinik GP dan pergigian yang mengambil bahagian (sehingga $23.50 untuk penyakit biasa, $85–$130 untuk keadaan kronik)",
        "Yuran saringan tetap $2 di bawah Healthier SG jika anda belum mendaftar",
      ],
      howToUse:
        "Tunjukkan NRIC anda di klinik CHAS, poliklinik, atau hospital awam — subsidi akan ditolak daripada bil anda secara automatik. Tiada permohonan berasingan diperlukan.",
    },
    ta: {
      benefits: [
        `உங்கள் ஆண்டு MediShield Life பிரீமியத்தில் ${medishieldSubsidy} மானியம்${medishieldSubsidyQualifier.ta}`,
        "பாலிக்ளினிக்குகள் மற்றும் பொது சிறப்பு வெளிநோயாளர் மருத்துவமனைகளில் மானியம் பெறும் சேவைகள் மற்றும் மருந்துகளுக்கான மீதமுள்ள பில்லில் கூடுதலாக 25% தள்ளுபடி",
        "பங்கேற்கும் GP மற்றும் பல் மருத்துவ கிளினிக்குகளில் அதிக CHAS-சமமான மானியங்கள் (பொதுவான நோய்களுக்கு $23.50 வரை, நீண்டகால நோய்களுக்கு $85–$130)",
        "Healthier SG-இல் இன்னும் பதிவு செய்யவில்லை என்றால், நிலையான $2 பரிசோதனை கட்டணம்",
      ],
      howToUse:
        "CHAS கிளினிக், பாலிக்ளினிக் அல்லது அரசு மருத்துவமனையில் உங்கள் NRIC-ஐ காட்டவும் — மானியம் தானாகவே உங்கள் பில்லில் இருந்து கழிக்கப்படும். தனியாக விண்ணப்பிக்க தேவையில்லை.",
    },
  };
}

const STATIC_DETAILS: Record<string, LocalizedDetail> = {
  chas_blue: {
    en: {
      benefits: [
        "The highest CHAS subsidy tier, for lower-income households",
        "Subsidised common-illness consultations at participating GP clinics",
        "Higher subsidies for chronic condition management under the Chronic Disease Management Programme (CDMP)",
        "Dental subsidies at participating CHAS dental clinics",
      ],
      howToUse:
        "Present your CHAS card or NRIC at a participating GP or dental clinic before payment — the subsidy is deducted from your bill automatically at the counter.",
    },
    zh: {
      benefits: [
        "CHAS津贴中最高的一档，适用于中低收入家庭",
        "在参与计划的普通科诊所享有常见疾病诊金津贴",
        "在慢性疾病护理计划（CDMP）下享有更高的慢性疾病管理津贴",
        "在参与计划的CHAS牙科诊所享有牙科津贴",
      ],
      howToUse:
        "付款前在参与计划的普通科或牙科诊所出示您的CHAS卡或身份证——津贴将在柜台自动从账单中扣除。",
    },
    ms: {
      benefits: [
        "Tahap subsidi CHAS yang tertinggi, untuk isi rumah berpendapatan rendah",
        "Konsultasi penyakit biasa bersubsidi di klinik GP yang mengambil bahagian",
        "Subsidi lebih tinggi untuk pengurusan keadaan kronik di bawah Program Pengurusan Penyakit Kronik (CDMP)",
        "Subsidi pergigian di klinik pergigian CHAS yang mengambil bahagian",
      ],
      howToUse:
        "Tunjukkan kad CHAS atau NRIC anda di klinik GP atau pergigian yang mengambil bahagian sebelum pembayaran — subsidi akan ditolak daripada bil anda secara automatik di kaunter.",
    },
    ta: {
      benefits: [
        "குறைந்த வருமானமுள்ள குடும்பங்களுக்கான மிக உயர்ந்த CHAS மானிய நிலை",
        "பங்கேற்கும் GP கிளினிக்குகளில் பொதுவான நோய்களுக்கான ஆலோசனைகளுக்கு மானியம்",
        "நீண்டகால நோய் மேலாண்மை திட்டத்தின் (CDMP) கீழ் நீண்டகால நோய் மேலாண்மைக்கு அதிக மானியங்கள்",
        "பங்கேற்கும் CHAS பல் மருத்துவ கிளினிக்குகளில் பல் மருத்துவ மானியங்கள்",
      ],
      howToUse:
        "கட்டணம் செலுத்துவதற்கு முன் பங்கேற்கும் GP அல்லது பல் மருத்துவ கிளினிக்கில் உங்கள் CHAS கார்டு அல்லது NRIC-ஐ காட்டவும் — மானியம் கவுண்டரில் தானாகவே உங்கள் பில்லில் இருந்து கழிக்கப்படும்.",
    },
  },
  chas_orange: {
    en: {
      benefits: [
        "A middle CHAS subsidy tier, available across a wider household income range",
        "Subsidised chronic condition management under CDMP at participating GP clinics",
        "Dental subsidies at participating CHAS dental clinics",
        "No subsidy for common-illness consultations — only chronic and dental care are covered at this tier",
      ],
      howToUse:
        "Present your CHAS card or NRIC at a participating GP or dental clinic before payment — the subsidy is deducted from your bill automatically at the counter.",
    },
    zh: {
      benefits: [
        "CHAS津贴中的中间档，适用于收入范围较广的家庭",
        "在参与计划的普通科诊所，慢性疾病管理可获CDMP津贴",
        "在参与计划的CHAS牙科诊所享有牙科津贴",
        "此档不提供常见疾病诊金津贴——仅涵盖慢性病及牙科护理",
      ],
      howToUse:
        "付款前在参与计划的普通科或牙科诊所出示您的CHAS卡或身份证——津贴将在柜台自动从账单中扣除。",
    },
    ms: {
      benefits: [
        "Tahap subsidi CHAS pertengahan, tersedia untuk julat pendapatan isi rumah yang lebih luas",
        "Pengurusan keadaan kronik bersubsidi di bawah CDMP di klinik GP yang mengambil bahagian",
        "Subsidi pergigian di klinik pergigian CHAS yang mengambil bahagian",
        "Tiada subsidi untuk konsultasi penyakit biasa — hanya penjagaan kronik dan pergigian dilindungi pada tahap ini",
      ],
      howToUse:
        "Tunjukkan kad CHAS atau NRIC anda di klinik GP atau pergigian yang mengambil bahagian sebelum pembayaran — subsidi akan ditolak daripada bil anda secara automatik di kaunter.",
    },
    ta: {
      benefits: [
        "பரந்த குடும்ப வருமான வரம்பில் கிடைக்கும் நடுத்தர CHAS மானிய நிலை",
        "பங்கேற்கும் GP கிளினிக்குகளில் CDMP-இன் கீழ் நீண்டகால நோய் மேலாண்மைக்கு மானியம்",
        "பங்கேற்கும் CHAS பல் மருத்துவ கிளினிக்குகளில் பல் மருத்துவ மானியங்கள்",
        "பொதுவான நோய் ஆலோசனைகளுக்கு மானியம் இல்லை — இந்த நிலையில் நீண்டகால நோய் மற்றும் பல் மருத்துவ சேவை மட்டுமே உள்ளடக்கப்படும்",
      ],
      howToUse:
        "கட்டணம் செலுத்துவதற்கு முன் பங்கேற்கும் GP அல்லது பல் மருத்துவ கிளினிக்கில் உங்கள் CHAS கார்டு அல்லது NRIC-ஐ காட்டவும் — மானியம் கவுண்டரில் தானாகவே உங்கள் பில்லில் இருந்து கழிக்கப்படும்.",
    },
  },
  chas_green: {
    en: {
      benefits: [
        "An entry-level CHAS subsidy tier, open to all Singaporeans regardless of income",
        "Subsidised chronic condition management under CDMP at participating GP clinics",
        "Dental subsidies at participating CHAS dental clinics",
        "No subsidy for common-illness consultations — only chronic and dental care are covered at this tier",
      ],
      howToUse:
        "Present your CHAS card or NRIC at a participating GP or dental clinic before payment — the subsidy is deducted from your bill automatically at the counter.",
    },
    zh: {
      benefits: [
        "入门级CHAS津贴档，不论收入，所有新加坡公民均可申请",
        "在参与计划的普通科诊所，慢性疾病管理可获CDMP津贴",
        "在参与计划的CHAS牙科诊所享有牙科津贴",
        "此档不提供常见疾病诊金津贴——仅涵盖慢性病及牙科护理",
      ],
      howToUse:
        "付款前在参与计划的普通科或牙科诊所出示您的CHAS卡或身份证——津贴将在柜台自动从账单中扣除。",
    },
    ms: {
      benefits: [
        "Tahap subsidi CHAS peringkat permulaan, terbuka kepada semua rakyat Singapura tanpa mengira pendapatan",
        "Pengurusan keadaan kronik bersubsidi di bawah CDMP di klinik GP yang mengambil bahagian",
        "Subsidi pergigian di klinik pergigian CHAS yang mengambil bahagian",
        "Tiada subsidi untuk konsultasi penyakit biasa — hanya penjagaan kronik dan pergigian dilindungi pada tahap ini",
      ],
      howToUse:
        "Tunjukkan kad CHAS atau NRIC anda di klinik GP atau pergigian yang mengambil bahagian sebelum pembayaran — subsidi akan ditolak daripada bil anda secara automatik di kaunter.",
    },
    ta: {
      benefits: [
        "வருமானத்தைப் பொருட்படுத்தாமல் அனைத்து சிங்கப்பூரர்களுக்கும் திறந்திருக்கும் தொடக்க-நிலை CHAS மானிய நிலை",
        "பங்கேற்கும் GP கிளினிக்குகளில் CDMP-இன் கீழ் நீண்டகால நோய் மேலாண்மைக்கு மானியம்",
        "பங்கேற்கும் CHAS பல் மருத்துவ கிளினிக்குகளில் பல் மருத்துவ மானியங்கள்",
        "பொதுவான நோய் ஆலோசனைகளுக்கு மானியம் இல்லை — இந்த நிலையில் நீண்டகால நோய் மற்றும் பல் மருத்துவ சேவை மட்டுமே உள்ளடக்கப்படும்",
      ],
      howToUse:
        "கட்டணம் செலுத்துவதற்கு முன் பங்கேற்கும் GP அல்லது பல் மருத்துவ கிளினிக்கில் உங்கள் CHAS கார்டு அல்லது NRIC-ஐ காட்டவும் — மானியம் கவுண்டரில் தானாகவே உங்கள் பில்லில் இருந்து கழிக்கப்படும்.",
    },
  },
  flexi_medisave: {
    en: {
      benefits: [
        "Up to $400 a year in MediSave withdrawals for outpatient treatment, on top of your regular MediSave uses",
        "Usable at polyclinics, public Specialist Outpatient Clinics, and participating CHAS GP clinics",
        "No chronic condition required — covers standard, non-chronic outpatient treatment",
        "Allowance renews every calendar year",
      ],
      howToUse:
        "Available automatically once you turn 60 — just ask the clinic counter to charge your visit to MediSave under Flexi-MediSave. Check your remaining balance in the CPF mobile app.",
    },
    zh: {
      benefits: [
        "每年可提取最高$400保健储蓄（MediSave）用于门诊治疗，在您常规保健储蓄用途之外",
        "可在综合诊疗所、公立专科门诊及参与计划的CHAS普通科诊所使用",
        "无需患有慢性疾病——涵盖一般非慢性门诊治疗",
        "额度每个日历年重新计算",
      ],
      howToUse:
        "年满60岁后自动生效——只需请诊所柜台以灵活保健储蓄（Flexi-MediSave）为您的诊金扣账。可在CPF手机应用查询余额。",
    },
    ms: {
      benefits: [
        "Sehingga $400 setahun dalam pengeluaran MediSave untuk rawatan pesakit luar, sebagai tambahan kepada penggunaan MediSave biasa anda",
        "Boleh digunakan di poliklinik, Klinik Pakar Luar (SOC) awam, dan klinik GP CHAS yang mengambil bahagian",
        "Tiada keadaan kronik diperlukan — meliputi rawatan pesakit luar biasa yang tidak kronik",
        "Elaun diperbaharui setiap tahun kalendar",
      ],
      howToUse:
        "Tersedia secara automatik sebaik sahaja anda berumur 60 tahun — cuma minta kaunter klinik mengenakan lawatan anda kepada MediSave di bawah Flexi-MediSave. Semak baki anda dalam aplikasi mudah alih CPF.",
    },
    ta: {
      benefits: [
        "உங்கள் வழக்கமான MediSave பயன்பாடுகளுக்கு மேலதிகமாக, வெளிநோயாளர் சிகிச்சைக்கு ஆண்டுக்கு $400 வரை MediSave எடுப்பு",
        "பாலிக்ளினிக்குகள், பொது சிறப்பு வெளிநோயாளர் கிளினிக்குகள் மற்றும் பங்கேற்கும் CHAS GP கிளினிக்குகளில் பயன்படுத்தலாம்",
        "நீண்டகால நோய் தேவையில்லை — வழக்கமான, நீண்டகாலமற்ற வெளிநோயாளர் சிகிச்சையை உள்ளடக்கும்",
        "ஒதுக்கீடு ஒவ்வொரு நாட்காட்டி ஆண்டும் புதுப்பிக்கப்படும்",
      ],
      howToUse:
        "நீங்கள் 60 வயதை அடைந்தவுடன் தானாகவே கிடைக்கும் — Flexi-MediSave-இன் கீழ் உங்கள் வருகையை MediSave-க்கு கட்டணமாக்கும்படி கிளினிக் கவுண்டரிடம் கேளுங்கள். CPF மொபைல் ஆப்பில் உங்கள் மீதமுள்ள இருப்பை சரிபார்க்கவும்.",
    },
  },
  medisave_cdmp: {
    en: {
      benefits: [
        "MediSave withdrawals for outpatient treatment of chronic conditions, capped per year and scaled to how many conditions you have",
        "Covers 23 MOH-approved chronic conditions, including diabetes, hypertension, stroke, asthma, and COPD",
        "Usable at GP clinics and polyclinics enrolled in the Chronic Disease Management Programme (CDMP)",
        "Since Feb 2024, enrolled clinics can charge eligible visits fully to MediSave — no 15% cash co-payment required",
      ],
      howToUse:
        "Check with your GP or polyclinic that they are CDMP-enrolled, then ask to charge eligible chronic-condition visits to MediSave — the clinic deducts directly from your MediSave account up to the annual cap.",
    },
    zh: {
      benefits: [
        "可提取保健储蓄用于慢性疾病门诊治疗，年度额度上限根据您所患慢性病数量而定",
        "涵盖23种卫生部认可的慢性疾病，包括糖尿病、高血压、中风、哮喘及慢阻肺",
        "可在参与慢性疾病护理计划（CDMP）的普通科诊所及综合诊疗所使用",
        "自2024年2月起，参与计划的诊所可将符合资格的诊费全额从保健储蓄扣除——无需支付15%现金共付额",
      ],
      howToUse:
        "向您的普通科医生或综合诊疗所确认是否已加入CDMP计划，然后请求以保健储蓄支付符合资格的慢性病诊费——诊所会直接从您的保健储蓄户头扣除，直至达到年度上限。",
    },
    ms: {
      benefits: [
        "Pengeluaran MediSave untuk rawatan pesakit luar bagi keadaan kronik, dihadkan setahun dan berskala mengikut bilangan keadaan yang anda ada",
        "Meliputi 23 keadaan kronik yang diluluskan MOH, termasuk diabetes, hipertensi, strok, asma, dan COPD",
        "Boleh digunakan di klinik GP dan poliklinik yang mendaftar dalam Program Pengurusan Penyakit Kronik (CDMP)",
        "Sejak Feb 2024, klinik berdaftar boleh mengenakan lawatan yang layak sepenuhnya kepada MediSave — tiada bayaran bersama tunai 15% diperlukan",
      ],
      howToUse:
        "Semak dengan GP atau poliklinik anda bahawa mereka berdaftar CDMP, kemudian minta lawatan keadaan kronik yang layak dikenakan kepada MediSave — klinik menolak terus daripada akaun MediSave anda sehingga had tahunan.",
    },
    ta: {
      benefits: [
        "நீண்டகால நோய்களுக்கான வெளிநோயாளர் சிகிச்சைக்கு MediSave எடுப்பு, ஆண்டுக்கு வரம்பு வைக்கப்பட்டு, உங்களுக்கு உள்ள நோய்களின் எண்ணிக்கைக்கு ஏற்ப அளவிடப்படும்",
        "நீரிழிவு, உயர் இரத்த அழுத்தம், பக்கவாதம், ஆஸ்துமா மற்றும் COPD உட்பட 23 MOH-அங்கீகரிக்கப்பட்ட நீண்டகால நோய்களை உள்ளடக்கும்",
        "நீண்டகால நோய் மேலாண்மை திட்டத்தில் (CDMP) பதிவு செய்யப்பட்ட GP கிளினிக்குகள் மற்றும் பாலிக்ளினிக்குகளில் பயன்படுத்தலாம்",
        "பிப்ரவரி 2024 முதல், பதிவு செய்யப்பட்ட கிளினிக்குகள் தகுதியான வருகைகளை முழுமையாக MediSave-க்கு கட்டணமாக்கலாம் — 15% பண இணை-கட்டணம் தேவையில்லை",
      ],
      howToUse:
        "உங்கள் GP அல்லது பாலிக்ளினிக் CDMP-இல் பதிவு செய்யப்பட்டுள்ளதா எனச் சரிபார்க்கவும், பின்னர் தகுதியான நீண்டகால நோய் வருகைகளை MediSave-க்கு கட்டணமாக்கக் கேளுங்கள் — கிளினிக் உங்கள் MediSave கணக்கிலிருந்து நேரடியாக ஆண்டு வரம்பு வரை கழிக்கும்.",
    },
  },
  medisave_outpatient_scans: {
    en: {
      benefits: [
        "Up to $600 a year in MediSave withdrawals for doctor-recommended diagnostic scans",
        "Covers CT, MRI, and PET scans at a polyclinic or public hospital",
        "Excludes plain X-rays and scans already covered under other schemes (e.g. cancer treatment or antenatal scans)",
        "No separate pre-approval needed beyond your doctor's recommendation",
      ],
      howToUse:
        "When your doctor orders a CT, MRI, or PET scan, tell the billing counter you want to use MediSave — the cost is deducted from your MediSave account, up to $600 a year.",
    },
    zh: {
      benefits: [
        "每年可提取最高$600保健储蓄，用于医生推荐的诊断扫描检查",
        "涵盖在综合诊疗所或公立医院进行的CT、MRI及PET扫描",
        "不包括普通X光及已受其他计划涵盖的扫描（如癌症治疗或产前扫描）",
        "只需医生推荐，无需另行预先批准",
      ],
      howToUse:
        "当医生安排CT、MRI或PET扫描时，告知收费柜台您要使用保健储蓄——费用将从您的保健储蓄户头扣除，每年最高$600。",
    },
    ms: {
      benefits: [
        "Sehingga $600 setahun dalam pengeluaran MediSave untuk imbasan diagnostik yang disyorkan doktor",
        "Meliputi imbasan CT, MRI, dan PET di poliklinik atau hospital awam",
        "Tidak termasuk X-ray biasa dan imbasan yang telah dilindungi di bawah skim lain (cth. rawatan kanser atau imbasan antenatal)",
        "Tiada kelulusan awal berasingan diperlukan selain daripada cadangan doktor anda",
      ],
      howToUse:
        "Apabila doktor anda menempah imbasan CT, MRI, atau PET, beritahu kaunter bil bahawa anda mahu menggunakan MediSave — kos akan ditolak daripada akaun MediSave anda, sehingga $600 setahun.",
    },
    ta: {
      benefits: [
        "மருத்துவர் பரிந்துரைத்த நோயறிதல் ஸ்கேன்களுக்கு ஆண்டுக்கு $600 வரை MediSave எடுப்பு",
        "பாலிக்ளினிக் அல்லது அரசு மருத்துவமனையில் CT, MRI மற்றும் PET ஸ்கேன்களை உள்ளடக்கும்",
        "வழக்கமான X-ray மற்றும் ஏற்கனவே பிற திட்டங்களின் கீழ் உள்ளடக்கப்பட்ட ஸ்கேன்களை (எ.கா. புற்றுநோய் சிகிச்சை அல்லது கர்ப்பகால ஸ்கேன்) விலக்கும்",
        "உங்கள் மருத்துவரின் பரிந்துரையைத் தவிர தனி முன் ஒப்புதல் தேவையில்லை",
      ],
      howToUse:
        "உங்கள் மருத்துவர் CT, MRI அல்லது PET ஸ்கேனை ஆர்டர் செய்யும் போது, MediSave பயன்படுத்த விரும்புவதாக பில்லிங் கவுண்டரிடம் கூறுங்கள் — செலவு உங்கள் MediSave கணக்கிலிருந்து, ஆண்டுக்கு $600 வரை கழிக்கப்படும்.",
    },
  },
  medisave_heavy_therapies: {
    en: {
      benefits: [
        "Substantial MediSave support for ongoing, high-cost outpatient treatment",
        "Covers kidney dialysis, cancer drug treatment, and radiotherapy",
        "MediShield Life also helps with these — e.g. its cancer drug treatment claim limit is $3,600 a year",
        "No single fixed dollar cap — the amount depends on your specific treatment and MOH's approved claim table",
      ],
      howToUse:
        "Speak to your hospital's billing or MediSave counter before starting treatment — they can tell you exactly how much of your dialysis, cancer drug, or radiotherapy bill can be charged to MediSave and MediShield Life.",
    },
    zh: {
      benefits: [
        "为持续、高额门诊治疗提供大量保健储蓄支持",
        "涵盖肾透析、癌症药物治疗及放射治疗",
        "终身健保（MediShield Life）也提供帮助——例如癌症药物治疗的每年索赔限额为$3,600",
        "没有单一固定金额上限——具体金额取决于您的治疗方案及卫生部核准的索赔表",
      ],
      howToUse:
        "开始治疗前，请咨询医院的收费或保健储蓄柜台——他们可以准确告知您的透析、癌症药物或放射治疗账单中，有多少可用保健储蓄及终身健保支付。",
    },
    ms: {
      benefits: [
        "Sokongan MediSave yang besar untuk rawatan pesakit luar berterusan dan berkos tinggi",
        "Meliputi dialisis buah pinggang, rawatan ubat kanser, dan radioterapi",
        "MediShield Life turut membantu dengan ini — cth. had tuntutan rawatan ubat kanser ialah $3,600 setahun",
        "Tiada had dolar tetap tunggal — jumlahnya bergantung kepada rawatan khusus anda dan jadual tuntutan yang diluluskan MOH",
      ],
      howToUse:
        "Bercakap dengan kaunter bil atau MediSave hospital anda sebelum memulakan rawatan — mereka boleh memberitahu anda dengan tepat berapa banyak bil dialisis, ubat kanser, atau radioterapi anda boleh dikenakan kepada MediSave dan MediShield Life.",
    },
    ta: {
      benefits: [
        "தொடர்ச்சியான, அதிக செலவு கொண்ட வெளிநோயாளர் சிகிச்சைக்கு கணிசமான MediSave ஆதரவு",
        "சிறுநீரக டயாலிசிஸ், புற்றுநோய் மருந்து சிகிச்சை மற்றும் கதிர்வீச்சு சிகிச்சையை உள்ளடக்கும்",
        "MediShield Life-ம் இவற்றுக்கு உதவுகிறது — எ.கா. அதன் புற்றுநோய் மருந்து சிகிச்சை உரிமைகோரல் வரம்பு ஆண்டுக்கு $3,600",
        "ஒரு நிலையான டாலர் வரம்பு இல்லை — தொகை உங்கள் குறிப்பிட்ட சிகிச்சை மற்றும் MOH-இன் அங்கீகரிக்கப்பட்ட உரிமைகோரல் அட்டவணையைப் பொறுத்தது",
      ],
      howToUse:
        "சிகிச்சையைத் தொடங்குவதற்கு முன் உங்கள் மருத்துவமனையின் பில்லிங் அல்லது MediSave கவுண்டரிடம் பேசுங்கள் — உங்கள் டயாலிசிஸ், புற்றுநோய் மருந்து அல்லது கதிர்வீச்சு பில்லில் எவ்வளவு MediSave மற்றும் MediShield Life-க்கு கட்டணமாக்க முடியும் என்பதை அவர்கள் சரியாகக் கூறுவார்கள்.",
    },
  },
  medisave_vaccinations_screenings: {
    en: {
      benefits: [
        "Covers adult vaccines including influenza, pneumococcal, HPV, Hepatitis B, MMR, Tdap, varicella, and shingles",
        "Covers recommended screenings, such as mammograms for women 50 and above and selected newborn screening tests",
        "Draws from the same annual MediSave withdrawal pool as chronic disease treatment, not a separate allowance",
        "Coverage amount depends on which vaccine or screening was given",
      ],
      howToUse:
        "Ask your clinic or polyclinic whether the specific vaccine or screening you need is MediSave-claimable — eligible ones are deducted automatically from your MediSave account.",
    },
    zh: {
      benefits: [
        "涵盖成人疫苗，包括流感、肺炎球菌、HPV、乙型肝炎、MMR、百白破、水痘及带状疱疹疫苗",
        "涵盖建议筛查项目，如50岁以上女性的乳房X光检查及部分新生儿筛查测试",
        "与慢性疾病治疗共用同一年度保健储蓄提取额度，并非独立津贴",
        "涵盖金额视所接种疫苗或筛查项目而定",
      ],
      howToUse:
        "请向您的诊所或综合诊疗所询问所需的特定疫苗或筛查是否可用保健储蓄支付——符合资格的项目将自动从您的保健储蓄户头扣除。",
    },
    ms: {
      benefits: [
        "Meliputi vaksin dewasa termasuk influenza, pneumokokus, HPV, Hepatitis B, MMR, Tdap, varicella, dan shingles",
        "Meliputi saringan yang disyorkan, seperti mamogram untuk wanita berumur 50 tahun ke atas dan ujian saringan bayi baru lahir terpilih",
        "Diambil daripada kumpulan pengeluaran MediSave tahunan yang sama seperti rawatan penyakit kronik, bukan elaun berasingan",
        "Jumlah perlindungan bergantung kepada vaksin atau saringan yang diberikan",
      ],
      howToUse:
        "Tanya klinik atau poliklinik anda sama ada vaksin atau saringan khusus yang anda perlukan boleh dituntut MediSave — yang layak akan ditolak secara automatik daripada akaun MediSave anda.",
    },
    ta: {
      benefits: [
        "இன்ஃப்ளூயன்சா, நிமோகோக்கல், HPV, ஹெபடைடிஸ் B, MMR, Tdap, சின்னம்மை மற்றும் ஹெர்பீஸ் ஸாஸ்டர் உட்பட பெரியவர் தடுப்பூசிகளை உள்ளடக்கும்",
        "50 வயது மற்றும் அதற்கு மேற்பட்ட பெண்களுக்கான மேமோகிராம் மற்றும் தேர்ந்தெடுக்கப்பட்ட புதிதாய் பிறந்த குழந்தை பரிசோதனைகள் போன்ற பரிந்துரைக்கப்பட்ட பரிசோதனைகளை உள்ளடக்கும்",
        "நீண்டகால நோய் சிகிச்சையைப் போலவே அதே ஆண்டு MediSave எடுப்பு தொகுப்பிலிருந்து பயன்படுத்தப்படும், தனி ஒதுக்கீடு அல்ல",
        "உள்ளடக்கிய தொகை எந்த தடுப்பூசி அல்லது பரிசோதனை வழங்கப்பட்டது என்பதைப் பொறுத்தது",
      ],
      howToUse:
        "உங்களுக்குத் தேவையான குறிப்பிட்ட தடுப்பூசி அல்லது பரிசோதனை MediSave-மூலம் உரிமைகோரக்கூடியதா என உங்கள் கிளினிக் அல்லது பாலிக்ளினிக்கிடம் கேளுங்கள் — தகுதியானவை உங்கள் MediSave கணக்கிலிருந்து தானாகவே கழிக்கப்படும்.",
    },
  },
  medishield_life: {
    en: {
      benefits: [
        "Basic health insurance covering large hospital bills and selected costly outpatient treatments",
        "Automatic coverage for all Singapore Citizens and Permanent Residents, regardless of pre-existing conditions",
        "Annual claim limit of $200,000, with no lifetime limit",
        "Co-insurance (your share of the claimable amount) starts at 10% and decreases as the claimable amount rises",
        "Premiums are paid automatically from your MediSave account, with larger subsidies for lower- and middle-income households",
      ],
      howToUse:
        "MediShield Life applies automatically at any public hospital or polyclinic — there's nothing to activate. Ask the billing counter how much of your bill MediShield Life has covered.",
    },
    zh: {
      benefits: [
        "基本医疗保险，涵盖高额住院账单及部分高费用门诊治疗",
        "所有新加坡公民及永久居民自动获得保障，不论是否有既往病史",
        "每年索赔限额为$200,000，无终身限额",
        "共同保险（您需自付的索赔金额比例）从10%起，索赔金额越高，该比例越低",
        "保费自动从您的保健储蓄户头扣除，中低收入家庭可获更高津贴",
      ],
      howToUse:
        "终身健保（MediShield Life）在任何公立医院或综合诊疗所自动生效——无需另行启用。请向收费柜台查询终身健保已承担您账单的具体金额。",
    },
    ms: {
      benefits: [
        "Insurans kesihatan asas yang meliputi bil hospital yang besar dan rawatan pesakit luar terpilih yang mahal",
        "Perlindungan automatik untuk semua Warganegara Singapura dan Penduduk Tetap, tanpa mengira keadaan sedia ada",
        "Had tuntutan tahunan $200,000, tiada had seumur hidup",
        "Ko-insurans (bahagian anda daripada jumlah yang boleh dituntut) bermula pada 10% dan berkurangan apabila jumlah yang boleh dituntut meningkat",
        "Premium dibayar secara automatik daripada akaun MediSave anda, dengan subsidi lebih besar untuk isi rumah berpendapatan rendah dan sederhana",
      ],
      howToUse:
        "MediShield Life terpakai secara automatik di mana-mana hospital atau poliklinik awam — tiada apa yang perlu diaktifkan. Tanya kaunter bil berapa banyak bil anda telah dilindungi oleh MediShield Life.",
    },
    ta: {
      benefits: [
        "பெரிய மருத்துவமனை பில்கள் மற்றும் தேர்ந்தெடுக்கப்பட்ட அதிக செலவு கொண்ட வெளிநோயாளர் சிகிச்சைகளை உள்ளடக்கிய அடிப்படை சுகாதார காப்பீடு",
        "முன்பே இருந்த நோய்நிலைகளைப் பொருட்படுத்தாமல் அனைத்து சிங்கப்பூர் குடிமக்கள் மற்றும் நிரந்தர குடியிருப்பாளர்களுக்கும் தானியங்கு பாதுகாப்பு",
        "ஆண்டு உரிமைகோரல் வரம்பு $200,000, வாழ்நாள் வரம்பு இல்லை",
        "இணை-காப்பீடு (உரிமைகோரக்கூடிய தொகையில் உங்கள் பங்கு) 10%-இல் தொடங்கி, உரிமைகோரக்கூடிய தொகை அதிகரிக்கும் போது குறையும்",
        "பிரீமியங்கள் உங்கள் MediSave கணக்கிலிருந்து தானாகவே செலுத்தப்படும், குறைந்த மற்றும் நடுத்தர வருமான குடும்பங்களுக்கு அதிக மானியங்கள்",
      ],
      howToUse:
        "MediShield Life எந்த அரசு மருத்துவமனை அல்லது பாலிக்ளினிக்கிலும் தானாகவே பொருந்தும் — இயக்க எதுவும் தேவையில்லை. உங்கள் பில்லில் MediShield Life எவ்வளவு ஈடுசெய்துள்ளது என்பதை பில்லிங் கவுண்டரிடம் கேளுங்கள்.",
    },
  },
  medifund: {
    en: {
      benefits: [
        "A safety net of last resort for households who still can't afford their bill after all other subsidies",
        "Assessed case-by-case based on financial need, not a fixed percentage or dollar amount",
        "Available at public hospitals, national specialist centres, and Community Hospitals",
      ],
      howToUse:
        "Ask to speak to a Medical Social Worker (MSW) at the hospital — they'll assess your household's financial situation and help you apply for MediFund support.",
    },
    zh: {
      benefits: [
        "为享用所有其他津贴后仍无法负担账单的家庭提供最后保障",
        "根据个别经济需要逐案评估，并非固定比例或固定金额",
        "适用于公立医院、国家专科中心及社区医院",
      ],
      howToUse:
        "请要求与医院的医务社工（MSW）会谈——他们会评估您家庭的经济状况，并协助您申请医疗基金（MediFund）援助。",
    },
    ms: {
      benefits: [
        "Jaring keselamatan pilihan terakhir untuk isi rumah yang masih tidak mampu membayar bil selepas semua subsidi lain",
        "Dinilai kes demi kes berdasarkan keperluan kewangan, bukan peratusan atau jumlah dolar tetap",
        "Tersedia di hospital awam, pusat pakar kebangsaan, dan Hospital Komuniti",
      ],
      howToUse:
        "Minta untuk bercakap dengan Pekerja Sosial Perubatan (MSW) di hospital — mereka akan menilai keadaan kewangan isi rumah anda dan membantu anda memohon sokongan MediFund.",
    },
    ta: {
      benefits: [
        "மற்ற அனைத்து மானியங்களுக்குப் பிறகும் பில்லைச் செலுத்த முடியாத குடும்பங்களுக்கான கடைசி பாதுகாப்பு வலை",
        "நிலையான சதவீதம் அல்லது டாலர் தொகை அல்ல, நிதி தேவையின் அடிப்படையில் தனித்தனியாக மதிப்பிடப்படும்",
        "அரசு மருத்துவமனைகள், தேசிய சிறப்பு மையங்கள் மற்றும் சமூக மருத்துவமனைகளில் கிடைக்கும்",
      ],
      howToUse:
        "மருத்துவமனையில் மருத்துவ சமூக பணியாளரிடம் (MSW) பேச கேளுங்கள் — அவர்கள் உங்கள் குடும்பத்தின் நிதி நிலையை மதிப்பிட்டு, MediFund ஆதரவுக்கு விண்ணப்பிக்க உதவுவார்கள்.",
    },
  },
};

/**
 * Looks up the curated detail for a scheme, tailoring Pioneer/Merdeka
 * Generation content to the caller's birth year where known (their MediShield
 * Life premium subsidy and, for Pioneer, MediSave top-up amount both scale
 * with age), and returning the requested language's copy. Every other scheme's
 * detail is fixed regardless of birth year.
 */
export function getSubsidyDetail(
  schemeId: string,
  birthYear: number | undefined,
  language: Language
): SubsidyDetail | undefined {
  if (schemeId === "pioneer_generation") return pioneerDetail(birthYear)[language];
  if (schemeId === "merdeka_generation") return merdekaDetail(birthYear)[language];
  return STATIC_DETAILS[schemeId]?.[language];
}
