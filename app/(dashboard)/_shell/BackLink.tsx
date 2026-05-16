'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export function BackLink() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  if (isHome) {
    return (
      <span className="text-sm font-semibold text-zinc-100">Polaris</span>
    )
  }

  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      <span>Back</span>
    </Link>
  )
}
