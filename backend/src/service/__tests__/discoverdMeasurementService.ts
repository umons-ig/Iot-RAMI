import {
  discoveredMeasurements,
  addDiscoveredMeasurement,
} from "@service/discoverdMeasurementService";

describe("discoverdMeasurementService", () => {
  beforeEach(() => {
    discoveredMeasurements.clear();
  });

  describe("addDiscoveredMeasurement", () => {
    test("should add a new entry when the measurement type is seen for the first time", () => {
      addDiscoveredMeasurement("ecg");

      expect(discoveredMeasurements.has("ecg")).toBe(true);
      const entry = discoveredMeasurements.get("ecg");
      expect(entry).toBeDefined();
      expect(entry!.measurementType).toBe("ecg");
      expect(entry!.count).toBe(1);
      expect(entry!.firstSeenAt).toBeDefined();
      expect(entry!.lastSeenAt).toBeDefined();
    });

    test("should set firstSeenAt and lastSeenAt to the same value on first insertion", () => {
      addDiscoveredMeasurement("temperature");

      const entry = discoveredMeasurements.get("temperature")!;
      expect(entry.firstSeenAt).toBe(entry.lastSeenAt);
    });

    test("should increment count and update lastSeenAt when the measurement type is seen again", () => {
      addDiscoveredMeasurement("humidity");
      const firstSeenAt = discoveredMeasurements.get("humidity")!.firstSeenAt;

      // Small delay so the timestamp can differ
      const before = new Date().toISOString();
      addDiscoveredMeasurement("humidity");
      const after = new Date().toISOString();

      const entry = discoveredMeasurements.get("humidity")!;
      expect(entry.count).toBe(2);
      expect(entry.firstSeenAt).toBe(firstSeenAt);
      expect(entry.lastSeenAt >= before).toBe(true);
      expect(entry.lastSeenAt <= after).toBe(true);
    });

    test("should increment count correctly after multiple calls", () => {
      addDiscoveredMeasurement("ecg");
      addDiscoveredMeasurement("ecg");
      addDiscoveredMeasurement("ecg");

      expect(discoveredMeasurements.get("ecg")!.count).toBe(3);
    });

    test("should handle multiple distinct measurement types independently", () => {
      addDiscoveredMeasurement("ecg");
      addDiscoveredMeasurement("temperature");
      addDiscoveredMeasurement("humidity");

      expect(discoveredMeasurements.size).toBe(3);
      expect(discoveredMeasurements.get("ecg")!.count).toBe(1);
      expect(discoveredMeasurements.get("temperature")!.count).toBe(1);
      expect(discoveredMeasurements.get("humidity")!.count).toBe(1);
    });

    test("should not affect other entries when one entry is updated", () => {
      addDiscoveredMeasurement("ecg");
      addDiscoveredMeasurement("temperature");
      addDiscoveredMeasurement("ecg");

      expect(discoveredMeasurements.get("ecg")!.count).toBe(2);
      expect(discoveredMeasurements.get("temperature")!.count).toBe(1);
    });

    test("should store a valid ISO 8601 timestamp in firstSeenAt and lastSeenAt", () => {
      addDiscoveredMeasurement("ecg");

      const entry = discoveredMeasurements.get("ecg")!;
      expect(() => new Date(entry.firstSeenAt)).not.toThrow();
      expect(() => new Date(entry.lastSeenAt)).not.toThrow();
      expect(new Date(entry.firstSeenAt).toISOString()).toBe(entry.firstSeenAt);
    });
  });
});
