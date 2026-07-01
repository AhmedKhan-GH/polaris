type NoteForExport = { id: string; title: string; body: string };

/**
 * Render a note as a downloadable Markdown document — the title as an H1 heading
 * followed by the body (which is already Markdown). Pure (no DOM): the caller
 * turns `{ filename, text }` into a Blob download. Filename is the short id.
 */
export function noteToMarkdown(note: NoteForExport): { filename: string; text: string } {
  const heading = note.title.trim() || 'Untitled note';
  return {
    filename: `note-${note.id.slice(0, 8)}.md`,
    text: `# ${heading}\n\n${note.body}\n`,
  };
}
