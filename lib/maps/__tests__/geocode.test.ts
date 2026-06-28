// Unit tests for the server-side geocoding helper.
// The HTTP client is mocked so tests never call Google.
// Command: `npm run test -- lib/maps/__tests__/geocode.test.ts`

import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  GOOGLE_MAPS_SERVER_KEY: "server-key",
}));

vi.mock("@/lib/env", () => ({
  env: fake,
}));

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("geocode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns lat/lng from the first Google result", async () => {
    const { geocode } = await import("../geocode");
    const httpClient = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        status: "OK",
        results: [
          {
            geometry: {
              location: { lat: 37.4223878, lng: -122.0841877 },
            },
          },
        ],
      }),
    );

    const result = await geocode(
      "1600 Amphitheatre Pkwy, Mountain View",
      httpClient,
    );
    const requestedUrl = httpClient.mock.calls[0][0] as URL;

    expect(result).toEqual({ lat: 37.4223878, lng: -122.0841877 });
    expect(requestedUrl.searchParams.get("address")).toBe(
      "1600 Amphitheatre Pkwy, Mountain View",
    );
    expect(requestedUrl.searchParams.get("key")).toBe("server-key");
  });

  it("throws GeocodeNotFound when Google returns zero results", async () => {
    const { GeocodeNotFound, geocode } = await import("../geocode");
    const httpClient = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { status: "ZERO_RESULTS" }));

    await expect(geocode("Unknown address", httpClient)).rejects.toBeInstanceOf(
      GeocodeNotFound,
    );
  });

  it("throws GeocodeApiError when Google returns a non-200", async () => {
    const { GeocodeApiError, geocode } = await import("../geocode");
    const httpClient = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { status: "UNKNOWN_ERROR" }));

    await expect(geocode("1600 Amphitheatre", httpClient)).rejects.toBeInstanceOf(
      GeocodeApiError,
    );
  });
});
