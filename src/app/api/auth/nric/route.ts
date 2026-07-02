import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import { isValidNric } from "@/lib/nric";

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { nric: nricRaw, dateOfBirth } = body as Record<string, unknown>;

  const nric = typeof nricRaw === "string" ? nricRaw.trim().toUpperCase() : "";
  if (!isValidNric(nric)) {
    return NextResponse.json({ error: "Please enter a valid NRIC/FIN." }, { status: 400 });
  }
  if (typeof dateOfBirth !== "string" || !DOB_PATTERN.test(dateOfBirth)) {
    return NextResponse.json({ error: "Please enter a valid date of birth." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id, date_of_birth")
    .eq("nric", nric)
    .maybeSingle();

  if (lookupError) {
    console.error("[api/auth/nric] lookup error:", lookupError.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  let email: string;

  if (existing) {
    if (existing.date_of_birth !== dateOfBirth) {
      return NextResponse.json({ error: "NRIC or date of birth is incorrect." }, { status: 401 });
    }

    const { data: userLookup, error: userLookupError } = await admin.auth.admin.getUserById(existing.id);
    if (userLookupError || !userLookup.user?.email) {
      console.error("[api/auth/nric] user lookup error:", userLookupError?.message);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
    email = userLookup.user.email;
  } else {
    email = `${nric.toLowerCase()}@nric.internal`;
  }

  // `generateLink` with type "magiclink" creates the auth user if the email
  // doesn't exist yet, so it also handles the new-user case in one call.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken || !linkData.user) {
    console.error("[api/auth/nric] generateLink error:", linkError?.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  if (!existing) {
    // Upsert (not insert) in case an auth user already exists from a prior
    // attempt that failed after user creation but before the profile row was written.
    const { error: upsertError } = await admin.from("profiles").upsert({
      id: linkData.user.id,
      nric,
      date_of_birth: dateOfBirth,
    }, { onConflict: "id" });
    if (upsertError) {
      console.error("[api/auth/nric] upsert error:", upsertError.message);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: hashedToken,
  });
  if (verifyError) {
    console.error("[api/auth/nric] verifyOtp error:", verifyError.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
