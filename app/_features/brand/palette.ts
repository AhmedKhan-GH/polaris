// The Polaris Interface System palette — the app-wide working colors, surfaced on
// the Brand page as the reference every feature builds from. Each tone is
// theme-dependent: a light and a dark value, both mirroring
// a globals.css custom property. palette.test.ts WELDS the two so a value can never
// drift between here and the running theme, and re-checks AA on the documented
// pairs. Rationale + corpus grounding: .ai/uiux/DESIGN-INTENT.md.

export type Tone = {
  /** CSS var / Tailwind token stem: `surface` → `bg-surface`, `ink-muted` → `text-ink-muted`. */
  token: string;
  name: string;
  light: string;
  dark: string;
  role: string;
};

export type ToneGroup = { group: string; blurb: string; tones: Tone[] };

export const interfacePalette: ToneGroup[] = [
  {
    group: 'Surfaces',
    blurb: 'Elevation is surface value + a 1px hairline — never a shadow.',
    tones: [
      { token: 'bg', name: 'Canvas', light: '#ffffff', dark: '#0e1217', role: 'App background the panels sit on' },
      { token: 'surface', name: 'Surface', light: '#ffffff', dark: '#161b22', role: 'Panels, cards, list rows' },
      { token: 'surface-alt', name: 'Muted surface', light: '#f5f7f9', dark: '#1c222b', role: 'Table heads, insets, code' },
      { token: 'hairline', name: 'Hairline', light: '#e5e8ec', dark: '#272e38', role: '1px dividers between panes' },
      { token: 'hairline-strong', name: 'Strong hairline', light: '#cfd4db', dark: '#39414d', role: 'Input & control borders' },
    ],
  },
  {
    group: 'Text',
    blurb: 'One family (Geist); weight + tone carry hierarchy. Mono for data.',
    tones: [
      { token: 'ink', name: 'Primary', light: '#1a1f26', dark: '#e6e9ed', role: 'Titles and body copy' },
      { token: 'ink-muted', name: 'Muted', light: '#586170', dark: '#9aa3af', role: 'Labels, secondary metadata' },
      { token: 'ink-faint', name: 'Faint', light: '#646c78', dark: '#868f9d', role: 'Timestamps, hints, placeholders' },
    ],
  },
  {
    group: 'Accent',
    blurb: 'One action color — everything clickable, nothing decorative.',
    tones: [
      { token: 'accent', name: 'Action', light: '#00447c', dark: '#1f5fa8', role: 'Buttons & active nav (white text)' },
      { token: 'accent-text', name: 'Action text', light: '#00447c', dark: '#6fa6de', role: 'Links & active labels on surface' },
      { token: 'accent-soft', name: 'Action wash', light: '#e9eff6', dark: '#16243a', role: 'Selected row, subtle fills' },
    ],
  },
  {
    group: 'Brand line',
    blurb:
      'A thin brand signature at the top of the shell — sky in light, indigo in dark. A decorative brand accent, deliberately NOT the action color and confined to the header rule, so the one-accent restraint still holds.',
    tones: [
      { token: 'brand-line', name: 'Rule', light: '#15a4dd', dark: '#3d5bd9', role: 'Header top-rule (sky / indigo)' },
      { token: 'brand-line-soft', name: 'Wash', light: '#d4eefa', dark: '#1d2a4d', role: 'Soft strip fill behind headers' },
    ],
  },
];

export type StatusMarker = {
  /** Token stem: `success` → `text-success` on `bg-success-soft`. */
  token: string;
  name: string;
  /** The cold-chain ops reading — status hues encode data state, not chrome. */
  meaning: string;
  light: string;
  lightSoft: string;
  dark: string;
  darkSoft: string;
  role: string;
};

export const statusMarkers: StatusMarker[] = [
  {
    token: 'success',
    name: 'Success',
    meaning: 'In range',
    light: '#3a7140',
    lightSoft: '#eaf1ea',
    dark: '#6fb073',
    darkSoft: '#16241a',
    role: 'Temp within spec, task done, healthy',
  },
  {
    token: 'warning',
    name: 'Warning',
    meaning: 'At risk',
    light: '#8a5a12',
    lightSoft: '#f6eedd',
    dark: '#d9a24e',
    darkSoft: '#2a2310',
    role: 'SLA nearing, needs attention',
  },
  {
    token: 'danger',
    name: 'Alert',
    meaning: 'Breached',
    light: '#a83232',
    lightSoft: '#f7e7e7',
    dark: '#e0726f',
    darkSoft: '#2a1818',
    role: 'Out of range, failed, overdue',
  },
];
