'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createAccountAction } from './actions'

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'guest', label: 'Guest' },
] as const

const initialState = { error: undefined as string | undefined, success: false }

async function action(_prev: typeof initialState, formData: FormData) {
  const result = await createAccountAction(formData)
  if (result.error) return { error: result.error, success: false }
  return { error: undefined, success: true }
}

export function CreateAccountForm() {
  const [state, formAction, isPending] = useActionState(action, initialState)
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      router.refresh()
    }
  }, [state.success, router])

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-zinc-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          placeholder="user@example.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-zinc-400">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          placeholder="Minimum 6 characters"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-sm text-zinc-400">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          defaultValue="owner"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-zinc-500 focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {state.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-400">Account created.</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create Account'}
      </button>
    </form>
  )
}
