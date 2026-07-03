import { describe, it, expect, vi, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"

vi.mock("@/composables/useAxios.composable", () => ({
	useAxios: () => ({ axios: { get: vi.fn() } }),
}))

vi.mock("@/stores/measurement", () => ({
	useMeasurementStore: () => ({
		getMeasurementsByTypeAndSensor: vi.fn().mockReturnValue([
			{ timestamp: "2024-01-01T10:00:00", value: 42, type: "ecg", sensor: "s1" },
			{ timestamp: "2024-01-01T10:00:01", value: 43, type: "ecg", sensor: "s1" },
		]),
	}),
}))

import { useMeasurement } from "@/composables/useMeasurement.composable"

describe("useMeasurement", () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	describe("castIntoMeasurement()", () => {
		it("should cast MeasurementGet array correctly", () => {
			const { castIntoMeasurement } = useMeasurement()
			const input = [
				{
					measurementType: { name: "ecg" },
					value: 42.9,
					sensor: { name: "sensor1" },
					timestamp: "2024-01-01T10:00:00",
				},
			]
			const result = castIntoMeasurement(input as any)
			expect(result).toHaveLength(1)
			expect(result[0].type).toBe("ecg")
			expect(result[0].value).toBe(42) // Math.floor
			expect(result[0].sensor).toBe("sensor1")
			expect(result[0].timestamp).toBe("2024-01-01T10:00:00")
		})

		it("should floor float values", () => {
			const { castIntoMeasurement } = useMeasurement()
			const input = [{ measurementType: { name: "temp" }, value: 36.9, sensor: { name: "s1" }, timestamp: "t" }]
			const result = castIntoMeasurement(input as any)
			expect(result[0].value).toBe(36)
		})

		it("should return empty array for empty input", () => {
			const { castIntoMeasurement } = useMeasurement()
			expect(castIntoMeasurement([])).toEqual([])
		})
	})

	describe("initMeasurements()", () => {
		it("should create a structure per sensor and type", () => {
			const { initMeasurements } = useMeasurement()
			const result = initMeasurements(["ecg", "temp"], ["sensor1", "sensor2"])
			expect(result).toHaveLength(2)
			expect(result[0].sensor).toBe("sensor1")
			expect(result[0].measurementType).toHaveLength(2)
			expect(result[0].measurementType[0].type).toBe("ecg")
			expect(result[0].measurementType[0].measurements).toEqual([])
		})

		it("should return empty array for empty sensors", () => {
			const { initMeasurements } = useMeasurement()
			expect(initMeasurements(["ecg"], [])).toEqual([])
		})

		it("should return sensors with no types if types array is empty", () => {
			const { initMeasurements } = useMeasurement()
			const result = initMeasurements([], ["sensor1"])
			expect(result[0].measurementType).toEqual([])
		})
	})

	describe("refreshMeasurementsComposable()", () => {
		it("should add missing types to measurements", () => {
			const { refreshMeasurementsComposable } = useMeasurement()
			const existing = [{ type: "ecg", measurements: [] }]
			const result = refreshMeasurementsComposable(["ecg", "temp"], existing)
			expect(result).toHaveLength(2)
			expect(result.find(m => m.type === "temp")).toBeTruthy()
		})

		it("should not duplicate existing types", () => {
			const { refreshMeasurementsComposable } = useMeasurement()
			const existing = [{ type: "ecg", measurements: [] }]
			const result = refreshMeasurementsComposable(["ecg"], existing)
			expect(result).toHaveLength(1)
		})

		it("should return empty if both arrays are empty", () => {
			const { refreshMeasurementsComposable } = useMeasurement()
			expect(refreshMeasurementsComposable([], [])).toEqual([])
		})
	})

	describe("numberPointList()", () => {
		it("should return powers of 2 up to max", () => {
			const { numberPointList } = useMeasurement()
			expect(numberPointList(4)).toEqual([1, 2, 4, 8])
		})

		it("should return empty for max=0", () => {
			const { numberPointList } = useMeasurement()
			expect(numberPointList(0)).toEqual([])
		})

		it("should return [1] for max=1", () => {
			const { numberPointList } = useMeasurement()
			expect(numberPointList(1)).toEqual([1])
		})
	})

	describe("getTimestampArrayByTypeAndSensor()", () => {
		it("should return timestamps from store", () => {
			const { getTimestampArrayByTypeAndSensor } = useMeasurement()
			const result = getTimestampArrayByTypeAndSensor("ecg", "s1")
			expect(result).toEqual(["2024-01-01T10:00:00", "2024-01-01T10:00:01"])
		})
	})

	describe("getValueArrayByTypeAndSensor()", () => {
		it("should return values from store", () => {
			const { getValueArrayByTypeAndSensor } = useMeasurement()
			const result = getValueArrayByTypeAndSensor("ecg", "s1")
			expect(result).toEqual([42, 43])
		})
	})
})
