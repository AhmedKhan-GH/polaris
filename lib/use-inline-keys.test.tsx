// useInlineKeys — jsdom. Keyboard ergonomics shared by the inline-edit cells:
// Enter commits (by blurring, so the field's existing onBlur save runs and the
// field deselects), Escape cancels (reverts to the value the field had on focus
// and never saves). A normal blur (clicking away) still commits as before.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInlineKeys } from './use-inline-keys';

function Harness({ onCommit }: { onCommit: (value: string) => void }) {
  const keys = useInlineKeys((input) => onCommit(input.value));
  return (
    <input
      aria-label="field"
      defaultValue="A"
      onFocus={keys.onFocus}
      onKeyDown={keys.onKeyDown}
      onBlur={keys.onBlur}
    />
  );
}

afterEach(cleanup);

describe('useInlineKeys', () => {
  it('commits on Enter (runs the field onBlur with the typed value)', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('field') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'B' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('B');
  });

  it('cancels on Escape: reverts to the focused value and does NOT commit', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('field') as HTMLInputElement;
    fireEvent.focus(input); // focused value is "A"
    fireEvent.change(input, { target: { value: 'B' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('A');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('still commits on a normal blur (clicking away)', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('field') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'B' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('B');
  });

  it('resets after an Escape so a later edit still commits', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('field') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'B' } });
    fireEvent.keyDown(input, { key: 'Escape' }); // cancelled, no commit
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'C' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('C');
  });
});
