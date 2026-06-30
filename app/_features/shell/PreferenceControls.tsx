import { listTimeZones } from '@/lib/datetime';
import { getPreferences } from '@/lib/preferences';

import { Hour12Toggle } from './Hour12Toggle';
import { ThemeToggle } from './ThemeToggle';
import { TimezoneSelector } from './TimezoneSelector';

/**
 * The preference cluster for the authenticated top bar (ADR-0009). A server
 * component: it reads the caller's current prefs and the zone list, then hands
 * them to the two client controls as plain data — so neither control touches
 * `Intl` on the client and there is no hydration mismatch. PageHeader renders
 * this only when authed.
 */
export async function PreferenceControls() {
  const { timezone, hour12, theme } = await getPreferences();
  const zones = listTimeZones();

  return (
    <div className="flex items-center gap-2">
      <TimezoneSelector timezone={timezone} hour12={hour12} zones={zones} />
      <Hour12Toggle hour12={hour12} timezone={timezone} />
      <ThemeToggle theme={theme} timezone={timezone} hour12={hour12} />
    </div>
  );
}
