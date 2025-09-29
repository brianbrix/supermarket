export function resolveGeoLabel(result = {}) {
  return result.label
    ?? result.name
    ?? result.display_name
    ?? result.formatted
    ?? result.title
    ?? result.address?.label
    ?? result.address?.name
    ?? result.street
    ?? result.summary
    ?? '';
}

export function resolveGeoContext(result = {}) {
  const parts = [
    result.locality ?? result.city ?? result.town ?? result.village ?? result.hamlet ?? null,
    result.county ?? result.district ?? null,
    result.state ?? result.region ?? null,
    result.country ?? result.countryCode ?? result.country_code ?? null
  ].filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part);
  }
  return unique.join(', ');
}

function toFloat(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveGeoCoordinates(result = {}) {
  const lat = toFloat(
    result.lat ??
    result.latitude ??
    result.y ??
    result.position?.lat ??
    result.position?.latitude ??
    result.geometry?.lat ??
    result.geometry?.coordinates?.[1]
  );
  const lng = toFloat(
    result.lng ??
    result.lon ??
    result.long ??
    result.longitude ??
    result.x ??
    result.position?.lng ??
    result.position?.lon ??
    result.position?.longitude ??
    result.geometry?.lng ??
    result.geometry?.lon ??
    result.geometry?.longitude ??
    result.geometry?.coordinates?.[0]
  );
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
}

export function resolvePlaceId(result = {}) {
  return result.id
    ?? result.place_id
    ?? result.osm_id
    ?? result.osmId
    ?? result.mapbox_id
    ?? result.reference
    ?? null;
}
