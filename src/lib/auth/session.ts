import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSupabaseMissingEnvMessage,
  getSupabaseSiteUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import type { AuthFormState, AuthMode, AuthResult, SignOutResult } from "@/types";

function createAuthState(
  mode: AuthMode,
  status: AuthFormState["status"],
  message: string,
  redirectTo?: string,
): AuthResult {
  return {
    status,
    mode,
    message,
    redirectTo,
  };
}

export async function authenticateUser(input: {
  mode?: AuthMode | null;
  email?: string | null;
  password?: string | null;
}): Promise<AuthResult> {
  const mode = input.mode || "sign-in";
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");

  if (!isSupabaseConfigured()) {
    return createAuthState(mode, "error", getSupabaseMissingEnvMessage());
  }

  if (!email) {
    return createAuthState(mode, "error", "请输入邮箱地址。");
  }

  if (password.length < 6) {
    return createAuthState(mode, "error", "密码至少需要 6 位。");
  }

  const supabase = await createSupabaseServerClient();

  if (mode === "sign-up") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getSupabaseSiteUrl()}/auth/callback`,
      },
    });

    if (error) {
      return createAuthState(mode, "error", error.message);
    }

    if (data.session) {
      return createAuthState(mode, "success", "注册成功。", "/");
    }

    return createAuthState(
      mode,
      "success",
      "注册成功，请前往邮箱完成确认后再登录。",
    );
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return createAuthState(mode, "error", error.message);
  }

  return createAuthState(mode, "success", "登录成功。", "/");
}

export async function signOutCurrentUser(): Promise<SignOutResult> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  return {
    message: "已退出登录。",
    redirectTo: "/",
  };
}

