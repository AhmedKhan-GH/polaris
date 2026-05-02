'use client'

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PreferencesProvider } from './_features/preferences/PreferencesProvider'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Realtime keeps the cache fresh; we don't want time-based refetches
        // racing against pushed updates. Window-focus refetch is the safety
        // net for missed events after a tab regains focus.
        staleTime: Infinity,
        refetchOnWindowFocus: true,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient(): QueryClient {
  // On the server: always make a fresh client per request so requests don't
  // share state. On the client: reuse a singleton across renders so
  // suspending/re-rendering doesn't tear down in-flight queries.
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </QueryClientProvider>
  )
}
