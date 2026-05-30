'use client'

import { useActionState } from 'react'
import { signInAction, type AuthState } from './actions'

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signInAction,
    { errors: {} },
  )

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="h-12 rounded-lg border border-black/[.08] bg-transparent px-4 text-base transition-colors focus:border-foreground focus:outline-none dark:border-white/[.145]"
        />
        {state.errors?.email?.map((e) => (
          <p key={e} className="text-sm text-red-600">{e}</p>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="h-12 rounded-lg border border-black/[.08] bg-transparent px-4 text-base transition-colors focus:border-foreground focus:outline-none dark:border-white/[.145]"
        />
        {state.errors?.password?.map((e) => (
          <p key={e} className="text-sm text-red-600">{e}</p>
        ))}
      </div>

      {state.errors?.form?.map((e) => (
        <p key={e} className="text-sm text-red-600">{e}</p>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
