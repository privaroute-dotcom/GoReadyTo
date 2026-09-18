const EARTH_RADIUS_M = 6371008.8;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineDistanceM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function evaluateCaptureLocation(input: {
  current: { latitude: number; longitude: number };
  target: { latitude: number; longitude: number };
  accuracyM: number;
  maxDistanceM: number;
  maxAccuracyM: number;
}) {
  const distanceM = haversineDistanceM(input.current, input.target);
  const withinDistance = distanceM <= input.maxDistanceM;
  const accuracyGood = input.accuracyM <= input.maxAccuracyM;

  return {
    distanceM,
    accuracyM: input.accuracyM,
    withinDistance,
    accuracyGood,
    canCapture: withinDistance && accuracyGood,
  };
}
