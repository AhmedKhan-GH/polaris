import { getSessionUser } from '@/lib/auth/session'
import { LandingPage } from '@/app/_features/landing/LandingPage'

export default async function Home() {
  const session = await getSessionUser()

  return <LandingPage user={session ? { email: session.email } : null} />
}
