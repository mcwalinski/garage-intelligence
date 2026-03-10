export function formatCoordinate(value: number) {
  return value.toFixed(5);
}

export function hasUsableCoordinates(latitude?: number | null, longitude?: number | null) {
  return typeof latitude === "number" && typeof longitude === "number" && (latitude !== 0 || longitude !== 0);
}

export function getOpenStreetMapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`;
}

export function getGoogleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function getStaticMapUrl(latitude: number, longitude: number) {
  const url = new URL("https://staticmap.openstreetmap.de/staticmap.php");
  url.searchParams.set("center", `${latitude},${longitude}`);
  url.searchParams.set("zoom", "12");
  url.searchParams.set("size", "800x320");
  url.searchParams.set("maptype", "mapnik");
  url.searchParams.set("markers", `${latitude},${longitude},lightblue1`);
  return url.toString();
}
