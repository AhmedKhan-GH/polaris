import { auth } from '@/lib/auth'
import { LandingPage } from '@/app/_features/landing/LandingPage'

export default async function Home() {
  const session = await auth()

  return <LandingPage user={session?.user ?? null} />
}
