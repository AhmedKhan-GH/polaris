import { LoginForm } from '@/app/_features/auth/LoginForm'
import { PageHeader } from '@/app/_features/shell/PageHeader'

export default function LoginPage() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <PageHeader user={null} hideAuth />
      <main className="flex flex-1 w-full max-w-3xl mx-auto flex-col items-center gap-8 px-16 py-32">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Log in
        </h1>
        <LoginForm />
      </main>
    </div>
  )
}
