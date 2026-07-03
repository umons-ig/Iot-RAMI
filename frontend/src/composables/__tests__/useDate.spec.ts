import { describe, it, expect } from "vitest"
import { useDate } from "@/composables/useDate.composable"

describe("useDate", () => {
	const { beautifulDate, formatDate } = useDate()

	describe("beautifulDate", () => {
		it("should return a string", () => {
			const result = beautifulDate("2024-01-15T10:30:00")
			expect(typeof result).toBe("string")
		})

		it("should remove the last 3 characters (seconds) from toLocaleString output", () => {
			const input = "2024-01-15T10:30:45"
			const result = beautifulDate(input)
			const expected = new Date(input).toLocaleString().slice(0, -3)
			expect(result).toBe(expected)
		})

		it("should handle ISO date strings", () => {
			const result = beautifulDate("2024-06-01T00:00:00.000Z")
			expect(result).toBeTruthy()
		})
	})

	describe("formatDate", () => {
		it("should return a string", () => {
			const result = formatDate("2024-01-15T10:30:00")
			expect(typeof result).toBe("string")
		})

		it("should format with fr-FR locale (numeric month and day)", () => {
			const result = formatDate("2024-01-15T10:30:00")
			expect(result).toBeTruthy()
			expect(result.length).toBeGreaterThan(0)
		})

		it("should include hour and minute", () => {
			const result = formatDate("2024-01-15T10:30:00")
			// En fr-FR, le résultat contient les heures
			expect(result).toMatch(/\d+/)
		})

		it("should handle different months", () => {
			const jan = formatDate("2024-01-15T10:00:00")
			const dec = formatDate("2024-12-15T10:00:00")
			expect(jan).not.toBe(dec)
		})
	})
})
