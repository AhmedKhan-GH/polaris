'use client'

import { useState } from 'react'
import { resetPasswordAction } from './actions'

export function ResetPasswordButton({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<{ error?: string; success?: boolean }>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    setResult({})

    const fd = new FormData()
    fd.set('userId', userId)
    fd.set('password', password)

    const res = await resetPasswordAction(fd)
    setIsPending(false)

    if (res.error) {
      setResult({ error: res.error })
    } else {
      setResult({ success: true })
      setPassword('')
      setTimeout(() => {
        setOpen(false)
        setResult({})
      }, 1500)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Reset
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        required
        minLength={6}
        autoComplete="new-password"
        className="w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
      >
        {isPending ? '...' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setResult({}) }}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        Cancel
      </button>
      {result.error && <span className="text-xs text-red-400">{result.error}</span>}
      {result.success && <span className="text-xs text-green-400">Done</span>}
    </form>
  )
}
