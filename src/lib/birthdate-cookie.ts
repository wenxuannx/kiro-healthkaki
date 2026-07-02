// Client-side session cookie for the user's birthdate (YYYY-MM-DD).
// Omitting Max-Age/Expires makes it a session cookie — cleared when the browser closes.

const COOKIE_NAME = "hk_birthdate";

export function getBirthdateCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function setBirthdateCookie(isoDate: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(isoDate)}; path=/; SameSite=Lax`;
}

export function birthYearFromIsoDate(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}
