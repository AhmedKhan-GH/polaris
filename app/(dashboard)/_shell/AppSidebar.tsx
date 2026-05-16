'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from './nav-items'

interface AppSidebarProps {
  items: NavItem[]
}

export function AppSidebar({ items }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="shrink-0 w-52 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="px-4 py-4 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-100">Polaris</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        {items.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
