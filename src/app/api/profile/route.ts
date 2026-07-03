import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[api/profile] GET error:", error.message);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    full_name,
    citizenship_status,
    citizenship_year,
    household_monthly_income,
    household_size,
  } = body as Record<string, unknown>;

  const citizenshipStatuses = ["citizen", "pr", "foreigner"] as const;

  if (
    typeof citizenship_status !== "string" ||
    !citizenshipStatuses.includes(citizenship_status as (typeof citizenshipStatuses)[number])
  ) {
    return NextResponse.json({ error: "Citizenship status is required" }, { status: 400 });
  }
  if (typeof household_monthly_income !== "number") {
    return NextResponse.json({ error: "Household monthly income is required" }, { status: 400 });
  }
  if (typeof household_size !== "number") {
    return NextResponse.json({ error: "Household size is required" }, { status: 400 });
  }

  // The profile row (with date_of_birth/nric) is created at login time (see
  // /api/auth/nric), so this always updates an existing row — never inserts.
  // Using update() instead of upsert() avoids Postgres validating NOT NULL
  // constraints (like date_of_birth) against a candidate insert row that
  // upsert() would build even when a conflict redirects it to an update.
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: typeof full_name === "string" && full_name.trim() !== "" ? full_name.trim() : null,
      citizenship_status,
      citizenship_year: typeof citizenship_year === "number" ? citizenship_year : null,
      household_monthly_income,
      household_size,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[api/profile] POST error:", error.message);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
