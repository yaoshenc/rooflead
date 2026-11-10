// Daily forecast for a job site, summarised for roofing decisions.
// Source: Open-Meteo (open weather data; blends national models including
// BOM's). The BOM website's own API is not licensed for reuse.
const json = (d: unknown, s = 200, cache = "private, max-age=1800") =>
  Response.json(d, { status: s, headers: { "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });

const WMO: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain", 71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers",
  95: "Thunderstorms", 96: "Thunderstorms with hail", 99: "Thunderstorms with hail",
};

export type ForecastDay = { date: string; summary: string; code: number | null; rainChance: number | null; rainMm: number | null; tempMax: number | null; tempMin: number | null; windMax: number | null; gustMax: number | null };

async function geocode(place: string) {
  const name = place.replace(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT|New South Wales)\b/gi, "").replace(/\d{4}/g, "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < 3) return null;
  const u = new URL("https://geocoding-api.open-meteo.com/v1/search");
  u.search = new URLSearchParams({ name, count: "5", countryCode: "AU", language: "en", format: "json" }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const d: any = await r.json();
  const hit = (d.results || []).find((x: any) => /new south wales|nsw/i.test(x.admin1 || "")) || (d.results || [])[0];
  return hit ? { lat: +hit.latitude, lon: +hit.longitude, name: hit.name as string } : null;
}

export async function weatherEndpoint(request: Request) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, "no-store");
  const url = new URL(request.url);
  let lat = Number(url.searchParams.get("lat")), lon = Number(url.searchParams.get("lon")), place = "";
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !url.searchParams.get("lat")) {
      const q = String(url.searchParams.get("place") || "").slice(0, 120);
      const g = q ? await geocode(q) : null;
      if (!g) return json({ error: "Location not found for the weather forecast." }, 404, "no-store");
      lat = g.lat; lon = g.lon; place = g.name;
    }
    if (lat < -45 || lat > -9 || lon < 110 || lon > 155) return json({ error: "Weather is available for Australian locations." }, 400, "no-store");
    lat = Math.round(lat * 100) / 100; lon = Math.round(lon * 100) / 100;
    // Shared edge cache per ~1 km grid square for 30 minutes.
    const cacheKey = new Request(`https://rooflead.weather/${lat},${lon}`);
    const cache = (globalThis as any).caches?.default as Cache | undefined;
    const hit = await cache?.match(cacheKey);
    if (hit) { const d: any = await hit.json(); return json({ ...d, place: place || d.place }); }
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.search = new URLSearchParams({
      latitude: String(lat), longitude: String(lon), timezone: "Australia/Sydney", forecast_days: "10",
      daily: "precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,weather_code",
    }).toString();
    const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return json({ error: "The weather service did not respond. Retry shortly." }, 502, "no-store");
    const d: any = await r.json(), dl = d.daily || {};
    const n = (a: any[], i: number) => (a && a[i] !== null && a[i] !== undefined ? Math.round(Number(a[i]) * 10) / 10 : null);
    const days: ForecastDay[] = (dl.time || []).map((date: string, i: number) => ({
      date, code: n(dl.weather_code, i), summary: WMO[Number(dl.weather_code?.[i])] || "—",
      rainChance: n(dl.precipitation_probability_max, i), rainMm: n(dl.precipitation_sum, i),
      tempMax: n(dl.temperature_2m_max, i), tempMin: n(dl.temperature_2m_min, i),
      windMax: n(dl.wind_speed_10m_max, i), gustMax: n(dl.wind_gusts_10m_max, i),
    }));
    const body = { source: "Open-Meteo", attribution: "Weather data by Open-Meteo.com (CC BY 4.0)", lat, lon, place, fetchedAt: new Date().toISOString(), days };
    await cache?.put(cacheKey, new Response(JSON.stringify(body), { headers: { "Cache-Control": "max-age=1800", "Content-Type": "application/json" } }));
    return json(body);
  } catch {
    return json({ error: "The weather service did not respond. Retry shortly." }, 502, "no-store");
  }
}
