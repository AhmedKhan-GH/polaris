import { env } from "@/lib/env";

// Server-side Google geocoding helper. The API key comes from server env only.
// Unit command: `npm run test -- lib/maps/__tests__/geocode.test.ts`

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export class GeocodeNotFound extends Error {
  constructor(rawAddress: string) {
    super(`No geocode result found for address: ${rawAddress}`);
    this.name = "GeocodeNotFound";
  }
}

export class GeocodeApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodeApiError";
  }
}

type GeocodeHttpClient = typeof fetch;

type GoogleGeocodeResponse = {
  status: string;
  error_message?: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: unknown;
        lng?: unknown;
      };
    };
  }>;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
};

export async function geocode(
  rawAddress: string,
  httpClient: GeocodeHttpClient = fetch,
): Promise<GeocodeResult> {
  const address = rawAddress.trim();

  if (address.length === 0) {
    throw new GeocodeNotFound(rawAddress);
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("key", env.GOOGLE_MAPS_SERVER_KEY);

  const response = await httpClient(url);

  if (!response.ok) {
    throw new GeocodeApiError(`Geocoding API failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as GoogleGeocodeResponse;

  if (body.status !== "OK") {
    if (body.status === "ZERO_RESULTS") {
      throw new GeocodeNotFound(rawAddress);
    }

    throw new GeocodeApiError(
      body.error_message ?? `Geocoding API returned ${body.status}`,
    );
  }

  const location = body.results?.[0]?.geometry?.location;

  if (
    typeof location?.lat !== "number" ||
    typeof location.lng !== "number"
  ) {
    throw new GeocodeApiError("Geocoding API returned an invalid location");
  }

  return {
    lat: location.lat,
    lng: location.lng,
  };
}
