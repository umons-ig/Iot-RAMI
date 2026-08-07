interface DiscoveredMeasurement {
  measurementType: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
}

export const discoveredMeasurements = new Map<string, DiscoveredMeasurement>();

/**
 * Même exposition que le registre des topics : le `measureType` provient du
 * payload Kafka, non authentifié. Sans plafond ni validation, publier des types
 * de mesure aléatoires faisait croître cette Map sans limite.
 */
const MAX_DISCOVERED_MEASUREMENTS = 200;
const MAX_MEASUREMENT_LENGTH = 64;
const VALID_MEASUREMENT = /^[A-Za-z0-9_.-]+$/;

export const isValidDiscoveredMeasurement = (measurement: unknown): boolean =>
  typeof measurement === "string" &&
  measurement.length > 0 &&
  measurement.length <= MAX_MEASUREMENT_LENGTH &&
  VALID_MEASUREMENT.test(measurement);

export const addDiscoveredMeasurement = (measurement: string): void => {
  if (!isValidDiscoveredMeasurement(measurement)) return;

  const existing = discoveredMeasurements.get(measurement);
  const now = new Date().toISOString();
  if (existing) {
    existing.lastSeenAt = now;
    existing.count++;
    return;
  }

  // Éviction du moins récemment vu une fois le plafond atteint.
  if (discoveredMeasurements.size >= MAX_DISCOVERED_MEASUREMENTS) {
    let oldestKey: string | undefined;
    let oldestSeen = Infinity;
    for (const [key, value] of discoveredMeasurements) {
      const seen = Date.parse(value.lastSeenAt);
      if (seen < oldestSeen) {
        oldestSeen = seen;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) discoveredMeasurements.delete(oldestKey);
  }

  discoveredMeasurements.set(measurement, {
    measurementType: measurement,
    firstSeenAt: now,
    lastSeenAt: now,
    count: 1,
  });
};
