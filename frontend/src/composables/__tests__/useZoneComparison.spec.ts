import { describe, it, expect } from "vitest"
import { collectMeasureTypes, globalOrigin, buildOverlayChartData, buildSplitChartData, type SensorSeries } from "@/composables/useZoneComparison.composable"

const seriesA: SensorSeries = {
	sensorId: "a",
	sensorName: "Capteur A",
	points: [
		{ time: "2026-01-01T10:00:00Z", value: 20, MeasurementType: { name: "temperature" } },
		{ time: "2026-01-01T10:00:10Z", value: 22, MeasurementType: { name: "temperature" } },
	],
}
const seriesB: SensorSeries = {
	sensorId: "b",
	sensorName: "Capteur B",
	points: [
		{ time: "2026-01-01T10:00:05Z", value: 21, MeasurementType: { name: "temperature" } },
		{ time: "2026-01-01T10:00:05Z", value: 60, MeasurementType: { name: "humidity" } },
	],
}

describe("useZoneComparison — builders purs", () => {
	it("collectMeasureTypes renvoie l'union triée", () => {
		expect(collectMeasureTypes([seriesA, seriesB])).toEqual(["humidity", "temperature"])
	})

	it("globalOrigin renvoie le plus petit timestamp", () => {
		expect(globalOrigin([seriesA, seriesB])).toBe(new Date("2026-01-01T10:00:00Z").getTime())
	})

	it("buildOverlayChartData : un dataset par capteur pour un type donné, aligné sur l'origine", () => {
		const origin = globalOrigin([seriesA, seriesB])
		const chart = buildOverlayChartData([seriesA, seriesB], "temperature", origin)

		expect(chart.datasets).toHaveLength(2)
		expect(chart.datasets[0].label).toBe("Capteur A")
		// A commence à l'origine -> premier x = 0
		expect(chart.datasets[0].data[0]).toEqual({ x: 0, y: 20 })
		// B commence 5s après -> premier x = 5000 ms ; humidity exclue
		expect(chart.datasets[1].data).toEqual([{ x: 5000, y: 21 }])
	})

	it("buildSplitChartData : un dataset par type de mesure pour un capteur", () => {
		const chart = buildSplitChartData(seriesB)
		const labels = chart.datasets.map(d => d.label).sort()
		expect(labels).toEqual(["humidity", "temperature"])
	})

	it("gère des séries vides sans planter", () => {
		expect(globalOrigin([])).toBe(0)
		expect(buildOverlayChartData([], "temperature", 0).datasets).toEqual([])
		expect(buildSplitChartData({ sensorId: "x", sensorName: "X", points: [] }).datasets).toEqual([])
	})
})
