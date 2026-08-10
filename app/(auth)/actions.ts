"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  RegistrationFailed,
  SignInFailed,
  register,
  signIn,
} from "../../packages/auth/accounts";
import {
  SESSION_COOKIE,
  cookieOptions,
  createSession,
  destroySession,
} from "../../packages/auth/session";

export type AuthResult = { ok: false; message: string } | null;

async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function registerAction(
  _prev: AuthResult,
  form: FormData,
): Promise<AuthResult> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const organizationName = String(form.get("organizationName") ?? "");
  const displayName = String(form.get("displayName") ?? "");

  let userId: string;
  try {
    const result = await register({ email, password, organizationName, displayName });
    userId = result.userId;
  } catch (err) {
    if (err instanceof RegistrationFailed) return { ok: false, message: err.message };
    console.error("registration failed", err);
    return { ok: false, message: "Не вдалося створити обліковий запис. Спробуйте ще раз." };
  }

  await startSession(userId);
  // Straight to the profile: it is the only screen that does anything useful
  // for an organization that has just arrived.
  redirect("/profil");
}

export async function signInAction(_prev: AuthResult, form: FormData): Promise<AuthResult> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  let userId: string;
  try {
    userId = await signIn(email, password);
  } catch (err) {
    if (err instanceof SignInFailed) return { ok: false, message: err.message };
    console.error("sign-in failed", err);
    return { ok: false, message: "Не вдалося увійти. Спробуйте ще раз." };
  }

  await startSession(userId);
  redirect("/profil");
}

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/vhid");
}
