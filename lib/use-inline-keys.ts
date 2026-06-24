import { useRef } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

/**
 * Keyboard ergonomics for an inline-edit cell that auto-saves. Pass the field's
 * commit (the same work its blur-save did) and spread all three handlers:
 *
 *   const keys = useInlineKeys((input) => commitPrice(input));
 *   <input onFocus={keys.onFocus} onKeyDown={keys.onKeyDown} onBlur={keys.onBlur} />
 *
 * - **Enter** commits the current value, then blurs so the cell visually
 *   deselects.
 * - **Escape** reverts the box to the value it held on focus and blurs WITHOUT
 *   committing.
 * - A normal blur (clicking away) commits as before.
 *
 * The commit runs directly (not via the blur), so it never depends on the field
 * being the document's active element; the `blur()` calls are only for the
 * deselect. `skipBlur` keeps the deselect-blur after Enter/Escape from
 * committing a second time, and a fresh focus always clears it.
 *
 * One instance drives one field (its focus/skip state is per-field).
 */
export function useInlineKeys(commit: (input: HTMLInputElement) => void) {
  const focusedValue = useRef('');
  const skipBlur = useRef(false);

  function onFocus(e: FocusEvent<HTMLInputElement>) {
    focusedValue.current = e.currentTarget.value;
    skipBlur.current = false;
  }

  function onBlur(e: FocusEvent<HTMLInputElement>) {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    commit(e.currentTarget);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(e.currentTarget);
      skipBlur.current = true;
      e.currentTarget.blur(); // deselect; the resulting blur must not re-commit
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.value = focusedValue.current; // discard the edit
      skipBlur.current = true;
      e.currentTarget.blur();
    }
  }

  return { onFocus, onKeyDown, onBlur };
}
