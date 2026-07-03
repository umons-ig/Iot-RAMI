import { describe, it, expect } from "vitest"
import { useInformationMeasurement } from "@/composables/useInformationMeasurement.composable"

describe("useInformationMeasurement", () => {
	const { averageValue } = useInformationMeasurement()

	describe("averageValue", () => {
		it("should return the average of a list of values", () => {
			expect(averageValue([1, 2, 3, 4, 5])).toBe(3)
		})

		it("should return the value itself for a single-element array", () => {
			expect(averageValue([42])).toBe(42)
		})

		it("should round to 2 decimal places", () => {
			expect(averageValue([1, 2])).toBe(1.5)
			expect(averageValue([1, 1, 2])).toBe(1.33)
		})

		it("should handle negative values", () => {
			expect(averageValue([-1, -2, -3])).toBe(-2)
		})

		it("should handle a mix of positive and negative values", () => {
			expect(averageValue([-5, 5])).toBe(0)
		})

		it("should handle float values", () => {
			expect(averageValue([1.5, 2.5])).toBe(2)
		})

		it("should return 0 for an array of zeros", () => {
			expect(averageValue([0, 0, 0])).toBe(0)
		})
	})
})
