import { describe, it, expect, vi } from "vitest"

vi.mock("@/composables/useAxios.composable", () => ({
	useAxios: () => ({ axios: { get: vi.fn() } }),
}))

vi.mock("@/composables/useUser.composable", () => ({
	useUser: vi.fn(),
	UserFields: {},
	Role: {},
	Sex: {},
	EventTypes: { USER_REQUEST_SESSION_BY_SENSOR: "user.session.on.a.sensor" },
	handleEvent: vi.fn(),
}))

vi.mock("socket.io-client", () => ({
	io: vi.fn(() => ({ on: vi.fn(), disconnect: vi.fn() })),
}))

import { useSensor, SensorState } from "@/composables/useSensor.composable"

describe("useSensor", () => {
	describe("calculateDuration()", () => {
		const { calculateDuration } = useSensor(undefined)

		it("should calculate duration correctly", () => {
			const result = calculateDuration("2024-01-01T10:00:00", "2024-01-01T11:30:45")
			expect(result).toBe("1h 30m 45s")
		})

		it("should return 0h 0m 0s for same start and end", () => {
			const result = calculateDuration("2024-01-01T10:00:00", "2024-01-01T10:00:00")
			expect(result).toBe("0h 0m 0s")
		})

		it("should return Invalid date for bad dates", () => {
			const result = calculateDuration("not-a-date", "2024-01-01T10:00:00")
			expect(result).toBe("Invalid date")
		})

		it("should handle durations over 24h", () => {
			const result = calculateDuration("2024-01-01T00:00:00", "2024-01-02T02:00:00")
			expect(result).toBe("26h 0m 0s")
		})
	})

	describe("formatHumanReadableDate()", () => {
		const { formatHumanReadableDate } = useSensor(undefined)

		it("should return Invalid date for bad input", () => {
			const result = formatHumanReadableDate("not-a-date")
			expect(result).toBe("Invalid date")
		})

		it("should return a non-empty string for valid ISO date", () => {
			const result = formatHumanReadableDate("2024-06-15T10:30:00")
			expect(result).toBeTruthy()
			expect(result).not.toBe("Invalid date")
		})

		it("should omit time when omitTime=true", () => {
			const withTime = formatHumanReadableDate("2024-06-15T10:30:00", false)
			const withoutTime = formatHumanReadableDate("2024-06-15T10:30:00", true)
			expect(withTime.length).toBeGreaterThan(withoutTime.length)
		})
	})

	describe("handleSensorSelect()", () => {
		it("should update selectedSensor", () => {
			const { handleSensorSelect, selectedSensor } = useSensor(undefined)
			handleSensorSelect("sensor-abc")
			expect(selectedSensor.value).toBe("sensor-abc")
		})
	})

	describe("statusClass()", () => {
		it("should have status-unknown class initially", () => {
			const { statusClass } = useSensor(undefined)
			expect(statusClass.value["status-unknown"]).toBe(true)
			expect(statusClass.value["status-online"]).toBe(false)
		})

		it("should react to status changes", () => {
			const { status, statusClass } = useSensor(undefined)
			status.value = SensorState.ONLINE
			expect(statusClass.value["status-online"]).toBe(true)
			expect(statusClass.value["status-unknown"]).toBe(false)
		})

		it("should set status-error class", () => {
			const { status, statusClass } = useSensor(undefined)
			status.value = SensorState.ERROR
			expect(statusClass.value["status-error"]).toBe(true)
		})

		it("should set status-publishing class", () => {
			const { status, statusClass } = useSensor(undefined)
			status.value = SensorState.PUBLISHING
			expect(statusClass.value["status-publishing"]).toBe(true)
		})
	})
})
