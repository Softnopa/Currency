import "server-only";
import { cookies } from "next/headers";
import { dictionaries, LANG_COOKIE, parseLang } from "./i18n";
import { parsePrefs, PREFS_COOKIE } from "./prefs";

export async function getLang() {
  const cookieStore = await cookies();
  return parseLang(cookieStore.get(LANG_COOKIE)?.value);
}

export async function getT() {
  return dictionaries[await getLang()];
}

export async function getPrefs() {
  const cookieStore = await cookies();
  return parsePrefs(cookieStore.get(PREFS_COOKIE)?.value);
}
