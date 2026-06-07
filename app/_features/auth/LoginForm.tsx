import { signInAction } from './actions'

export function LoginForm() {
  return (
    <form action={signInAction} className="flex w-full max-w-sm flex-col gap-4">
      <button
        type="submit"
        className="flex h-12 items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Log in
      </button>
    </form>
  )
}
