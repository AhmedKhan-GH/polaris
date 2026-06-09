'use client'

import { useActionState, useEffect, useState } from 'react'
import { signInAction, type LoginState } from './actions'

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState)

  // Defer the form to the client. Password managers inject icon roots next to
  // <input type="password"> before React hydrates; suppressHydrationWarning
  // only covers one level, not extension-added children. Rendering after mount
  // avoids the SSR/CSR diff. Cost is a brief skeleton on first paint.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <div className="h-10 rounded border border-zinc-800 bg-zinc-900" />
        <div className="h-10 rounded border border-zinc-800 bg-zinc-900" />
        <div className="h-10 rounded bg-zinc-800" />
      </div>
    )
  }

  return (
    <>
      {state.error && <p className="mb-3 text-sm text-red-400">{state.error}</p>}
      <form action={formAction} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </>
  )
}
