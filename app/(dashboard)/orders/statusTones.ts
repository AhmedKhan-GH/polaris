/**
 * Status → Tailwind chip classes for the orders console (list rows, board cards,
 * status rail). Composition-layer shared constant so the views don't each carry
 * their own copy. Unknown statuses fall back to a neutral grey at the call site.
 */
export const statusTones: Record<string, string> = {
  draft: 'bg-zinc-200 text-zinc-800',
  submitted: 'bg-blue-100 text-blue-800',
  processing: 'bg-amber-100 text-amber-900',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
