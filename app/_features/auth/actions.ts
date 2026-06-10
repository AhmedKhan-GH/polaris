'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { recordSignIn } from '@/lib/audit/record-sign-in';
import { logger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabase/server';

/** The single field returned to the login form's `useActionState`. */
export interface LoginState {
  error?: string;
}

// `z.string().email()` is `@deprecated` in zod 4 in favour of `z.email()`; we
// use the non-deprecated form. Semantics are identical — both reject malformed
// addresses with the message "Invalid email address". `password.min(1)` only
// guards against an empty submission; authentication is GoTrue's job, not ours.
const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Authenticate an email/password submission, then redirect to the dashboard.
 *
 * Validation failures and bad credentials are returned as `{ error }` for the
 * form to render — they are NOT exceptions and never reach the audit log. Only a
 * genuine success records the durable sign-in fact (`recordSignIn`) and emits an
 * `info` line; a GoTrue rejection emits a `warn` line and stops. The signature
 * matches React's `useActionState` reducer: `(prevState, formData) => newState`.
 */
export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, password } = parsed.data;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    logger.warn({ email, reason: error.message }, 'login failed');
    return { error: error.message };
  }

  const userId = data.user?.id ?? null;
  await recordSignIn({ userId, email });
  logger.info({ email, userId }, 'login succeeded');
  redirect('/dashboard');
}

/**
 * Terminate the session and return to the public landing page. There is no
 * confirmation state to surface, so this returns void rather than `LoginState`.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}
