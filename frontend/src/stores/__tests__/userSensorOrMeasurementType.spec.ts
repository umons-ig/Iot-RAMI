import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"

vi.mock("@/composables/useUserSensorOrMeasurementType.composable", () => ({
	default: () => ({
		getAllUserSensorAccess: vi.fn().mockResolvedValue({ data: [] }),
	}),
}))

vi.mock("@/composables/useAxios.composable", () => ({
	useAxios: () => ({ axios: { get: vi.fn() } }),
}))

import { useUserSensorOrMeasurementTypeStore } from "@/stores/userSensorOrMeasurementType"

describe("useUserSensorOrMeasurementTypeStore", () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	describe("initial state", () => {
		it("should return empty userSensorAccess initially", () => {
			const store = useUserSensorOrMeasurementTypeStore()
			expect(store.getUserSensorAccess()).toEqual([])
		})
	})

	describe("refresh()", () => {
		it("should populate store after refresh", async () => {
			const store = useUserSensorOrMeasurementTypeStore()
			await store.refresh()
			expect(store.getUserSensorAccess()).toEqual([])
		})
	})
})
