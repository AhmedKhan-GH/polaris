// One brand color, presented. Server component (no interactivity). The color is
// passed in — components never hardcode tenant branding (Charter D8); the page
// feeds these from lib/branding.

export type BrandColor = { name: string; hex: string; role: string };

export function ColorSwatch({ color }: { color: BrandColor }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-14 w-14 shrink-0 rounded-md border border-zinc-200"
        style={{ backgroundColor: color.hex }}
        title={color.hex}
        aria-hidden
      />
      <div className="flex flex-col">
        <span className="font-medium">{color.name}</span>
        <span className="font-mono text-sm text-zinc-600">{color.hex}</span>
        <span className="text-sm text-zinc-500">{color.role}</span>
      </div>
    </div>
  );
}
