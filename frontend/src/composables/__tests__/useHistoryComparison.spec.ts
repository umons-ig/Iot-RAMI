import { describe, it, expect } from "vitest"
import { formatDuration, buildThresholdLines } from "@/composables/useHistoryComparison.composable"

describe("useHistoryComparison — helpers (§D)", () => {
	describe("formatDuration", () => {
		it("formate secondes / minutes", () => {
			expect(formatDuration(45_000)).toBe("45s")
			expect(formatDuration(90_000)).toBe("1m 30s")
			expect(formatDuration(120_000)).toBe("2m")
		})
		it("gère les valeurs invalides", () => {
			expect(formatDuration(-1)).toBe("—")
			expect(formatDuration(NaN)).toBe("—")
		})
	})

	describe("buildThresholdLines", () => {
		it("crée des lignes MIN et MAX horizontales sur [0, maxX]", () => {
			const lines = buildThresholdLines([{ minValue: 10, maxValue: 100 }], 5000)
			expect(lines).toHaveLength(2)
			const max = lines.find(l => l.label === "SEUIL MAX")!
			const min = lines.find(l => l.label === "SEUIL MIN")!
			expect(max.data).toEqual([
				{ x: 0, y: 100 },
				{ x: 5000, y: 100 },
			])
			expect(min.data).toEqual([
				{ x: 0, y: 10 },
				{ x: 5000, y: 10 },
			])
		})

		it("ignore les bornes nulles/absentes", () => {
			expect(buildThresholdLines([{ minValue: 5, maxValue: null }], 100)).toHaveLength(1)
			expect(buildThresholdLines([{}], 100)).toHaveLength(0)
		})
	})
})
