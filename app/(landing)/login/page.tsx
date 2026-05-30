import { LoginForm } from '@/app/_features/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 px-16 py-32">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Sign in
        </h1>
        <LoginForm />
      </main>
    </div>
  )
}
