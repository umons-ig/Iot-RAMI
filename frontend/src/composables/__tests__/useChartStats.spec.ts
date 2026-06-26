import { describe, it, expect } from "vitest"
import { ref } from "vue"
import type { ChartData } from "chart.js"
import { useChartStats, unitFor, MEASURE_UNITS } from "@/composables/useChartStats.composable"

const makeData = (): ChartData<"line"> =>
	({
		labels: [],
		datasets: [
			{
				label: "temperature",
				data: [
					{ x: 1, y: 20 },
					{ x: 2, y: 25 },
					{ x: 3, y: 30 },
				],
			},
			// Dataset de seuil : doit être ignoré par les stats.
			{ label: "MAX", data: [100, 100, 100], _isThreshold: true },
		],
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any)

describe("useChartStats", () => {
	it("calcule current/min/max/avg par mesure (hors seuils)", () => {
		const chartData = ref(makeData())
		const stats = useChartStats(chartData)

		expect(stats.value).toHaveLength(1) // le dataset seuil est exclu
		const temp = stats.value[0]
		expect(temp.label).toBe("temperature")
		expect(temp.current).toBe(30)
		expect(temp.min).toBe(20)
		expect(temp.max).toBe(30)
		expect(temp.avg).toBe(25)
		expect(temp.count).toBe(3)
		expect(temp.unit).toBe("°C")
	})

	it("réagit aux changements du chartData", () => {
		const chartData = ref(makeData())
		const stats = useChartStats(chartData)
		;(chartData.value.datasets[0].data as { x: number; y: number }[]).push({ x: 4, y: 10 })
		// Réassigne le wrapper (comme updateChart) pour déclencher la réactivité.
		chartData.value = { ...chartData.value }

		expect(stats.value[0].current).toBe(10)
		expect(stats.value[0].min).toBe(10)
		expect(stats.value[0].count).toBe(4)
	})

	it("gère un dataset vide", () => {
		const chartData = ref({ labels: [], datasets: [{ label: "ecg", data: [] }] } as ChartData<"line">)
		const stats = useChartStats(chartData)
		expect(stats.value[0]).toMatchObject({ current: null, min: null, max: null, avg: null, count: 0 })
	})

	it("unitFor renvoie l'unité connue ou vide", () => {
		expect(unitFor("humidity")).toBe("%")
		expect(unitFor("inconnu")).toBe("")
		expect(MEASURE_UNITS.spo2).toBe("%")
	})
})
