import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default icon paths break under bundlers — point at the CDN copy.
const PIN_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
import "./LocationMapPicker.css";

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Recognizes coordinates typed/pasted directly — either a bare "lat, lng"
    pair or a Google Maps link (full URL or share-page text) containing
    "@lat,lng", "q=lat,lng" or "ll=lat,lng" — so no geocoding call is needed
    at all when the user already has exact coordinates or a map link. */
function parseCoords(text: string): { lat: number; lng: number } | null {
  const plain = text.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }
  const urlMatch = text.match(/[@=](-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (urlMatch) {
    const lat = Number(urlMatch[1]);
    const lng = Number(urlMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }
  return null;
}

function stripPostalCode(query: string): string {
  return query.replace(/\s*-?\s*\b\d{5,6}\b\s*$/, "").trim();
}

/** Nominatim's free-text search is picky about over-specific addresses (an
    exact postal code or an extra suburb segment it doesn't have indexed is
    enough to return zero results, as it did for the user's real address).
    Retry with progressively less specific variants — first without a
    trailing postal code, then with leading (most specific) segments
    dropped one at a time — before giving up, so a near-miss address still
    lands the pin in roughly the right place instead of erroring out. */
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const noPostal = stripPostalCode(query);
  const attempts = [query];
  if (noPostal && noPostal !== query) attempts.push(noPostal);
  const parts = noPostal.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = 1; i < parts.length; i++) {
    attempts.push(parts.slice(i).join(", "));
  }

  for (const attempt of attempts) {
    if (!attempt) continue;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(attempt)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Search failed");
    const results = (await response.json()) as { lat: string; lon: string }[];
    if (results.length > 0) {
      return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
    }
  }
  return null;
}

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  /** The check-in radius, in meters — drawn as a circle around the pin so
      it's visually obvious how big the accepted zone actually is, not just
      a number in a text field. */
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}

/** Click-to-place OpenStreetMap picker (Leaflet), plus an address search box
    (OpenStreetMap's free Nominatim geocoder — no API key needed) that jumps
    the map straight to a typed address instead of hunting for it by hand.
    Clicking the map (or dragging the pin, or searching an address) drops/
    moves the pin and fills latitude/longitude automatically; a shaded circle
    around the pin always reflects the current radius. */
export function LocationMapPicker({ latitude, longitude, radiusMeters, onChange }: LocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [ready, setReady] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([20.5937, 78.9629], 5); // India-centred default
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      onChange(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
    setReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker and the radius circle in sync with the chosen
  // coordinates/radius.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || latitude == null || longitude == null) return;
    const latlng: L.LatLngExpression = [latitude, longitude];
    if (!markerRef.current) {
      markerRef.current = L.marker(latlng, { draggable: true, icon: PIN_ICON }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current?.getLatLng();
        if (pos) onChange(pos.lat, pos.lng);
      });
    } else {
      markerRef.current.setLatLng(latlng);
    }

    const radius = Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 0;
    if (!circleRef.current) {
      circleRef.current = L.circle(latlng, {
        radius,
        color: "#2065F6",
        fillColor: "#2065F6",
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latlng);
      circleRef.current.setRadius(radius);
    }

    // Fit the view to the circle's extent (capped so a huge radius doesn't
    // zoom all the way out to the whole country) rather than a fixed zoom,
    // so the whole check-in zone is visibly on screen after a search/pin.
    const bounds = circleRef.current.getBounds();
    map.fitBounds(bounds, { maxZoom: 17, padding: [24, 24] });
  }, [latitude, longitude, radiusMeters, ready, onChange]);

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function searchAddress() {
    const query = addressQuery.trim();
    if (!query || searching) return;
    setSearching(true);
    setSearchError("");
    try {
      const direct = parseCoords(query);
      if (direct) {
        onChange(direct.lat, direct.lng);
        return;
      }
      const found = await geocode(query);
      if (!found) {
        setSearchError(
          "No matching location found — try a shorter/less specific address, paste a Google Maps link, or type \"lat, lng\" coordinates.",
        );
        return;
      }
      onChange(found.lat, found.lng);
    } catch {
      setSearchError("Couldn't look up that address. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="location-picker">
      <div className="location-picker__search">
        <input
          type="text"
          value={addressQuery}
          placeholder="Type an address, paste a Google Maps link, or type lat, lng — then press Enter"
          onChange={(e) => setAddressQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              searchAddress();
            }
          }}
        />
        <button type="button" className="location-picker__search-btn" disabled={searching} onClick={searchAddress}>
          {searching ? "Searching…" : "Find"}
        </button>
      </div>
      {searchError && <p className="location-picker__search-error">{searchError}</p>}
      <div ref={containerRef} className="location-picker__map" />
      <button type="button" className="location-picker__gps" onClick={useMyLocation}>
        📍 Use my current location
      </button>
      <p className="location-picker__hint">
        Type an address, paste a Google Maps link, or type coordinates as "lat, lng" and press Enter — or click the
        map to drop the camera pin (or drag it), or use your current location. The shaded circle shows the check-in
        radius.
      </p>
    </div>
  );
}
