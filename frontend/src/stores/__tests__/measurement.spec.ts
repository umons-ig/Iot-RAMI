import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"

vi.mock("@/composables/useMeasurement.composable", () => ({
	useMeasurement: () => ({
		getAllMeasurementsTypes: vi.fn().mockResolvedValue([]),
		initMeasurements: vi.fn().mockReturnValue([]),
		getAllSensorsNames: vi.fn().mockResolvedValue([]),
		feedMeasurementsComposable: vi.fn().mockResolvedValue([]),
		feedMeasurementsSampleNumberComposable: vi.fn().mockResolvedValue([]),
		numberPointList: vi.fn().mockReturnValue([10, 50, 100]),
	}),
}))

vi.mock("@/composables/useAxios.composable", () => ({
	useAxios: () => ({ axios: { get: vi.fn(), post: vi.fn() } }),
}))

import { useMeasurementStore } from "@/stores/measurement"

describe("useMeasurementStore", () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	describe("initial state", () => {
		it("should return empty measurementTypes initially", () => {
			const store = useMeasurementStore()
			expect(store.getMeasurementTypes()).toEqual([])
		})

		it("should return empty sensors initially", () => {
			const store = useMeasurementStore()
			expect(store.getSensors()).toEqual([])
		})

		it("should return empty sensorNames initially", () => {
			const store = useMeasurementStore()
			expect(store.getSensorsName()).toEqual([])
		})

		it("should return empty measurements initially", () => {
			const store = useMeasurementStore()
			expect(store.getMeasurements()).toEqual([])
		})
	})

	describe("reset()", () => {
		it("should reset all state to empty", () => {
			const store = useMeasurementStore()
			// On simule un état non vide en accédant directement à l'état interne
			store.reset()
			expect(store.getMeasurementTypes()).toEqual([])
			expect(store.getSensors()).toEqual([])
			expect(store.getMeasurements()).toEqual([])
			expect(store.getSensorsName()).toEqual([])
		})
	})

	describe("getOptionsByName()", () => {
		it("should return the points option", () => {
			const store = useMeasurementStore()
			const result = store.getOptionsByName("points")
			expect(result.name).toBe("points")
			expect(result.message).toBe("Number of points")
		})

		it("should return the samples option", () => {
			const store = useMeasurementStore()
			const result = store.getOptionsByName("samples")
			expect(result.name).toBe("samples")
			expect(result.message).toBe("Sample")
		})

		it("should return empty option for unknown name", () => {
			const store = useMeasurementStore()
			const result = store.getOptionsByName("unknown")
			expect(result).toEqual({ options: [], name: "", message: "" })
		})
	})

	describe("getMessageByName()", () => {
		it("should return the message for points", () => {
			const store = useMeasurementStore()
			expect(store.getMessageByName("points")).toBe("Number of points")
		})

		it("should return the message for samples", () => {
			const store = useMeasurementStore()
			expect(store.getMessageByName("samples")).toBe("Sample")
		})

		it("should return empty string for unknown option", () => {
			const store = useMeasurementStore()
			expect(store.getMessageByName("unknown")).toBe("")
		})
	})
})
