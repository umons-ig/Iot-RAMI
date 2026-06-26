import { computed, type ComputedRef, type Ref } from "vue"
import type { ChartData } from "chart.js"

/**
 * Unités d'affichage par type de mesure. Le modèle backend MeasurementType ne
 * stocke pas d'unité ; on les mappe côté front (source unique). Type inconnu -> "".
 */
export const MEASURE_UNITS: Record<string, string> = {
	ecg: "mV",
	temperature: "°C",
	body_temperature: "°C",
	humidity: "%",
	pressure: "hPa",
	heart_rate: "bpm",
	breathing_rate: "rpm",
	spo2: "%",
	blood_pressure_systolic: "mmHg",
	blood_pressure_diastolic: "mmHg",
	gsr: "µS",
	distance: "m",
	x_position: "m",
	y_position: "m",
	people_count: "",
}

export const unitFor = (measureType: string): string => MEASURE_UNITS[measureType] ?? ""

export interface MeasureStat {
	label: string
	unit: string
	current: number | null
	min: number | null
	max: number | null
	avg: number | null
	count: number
}

type Point = { x: unknown; y: number }

/**
 * Statistiques par dataset (hors seuils) calculées à partir du chartData :
 * valeur courante (dernier point), min, max, moyenne, nb de points.
 * Réactif — recalculé quand chartData change.
 */
export const useChartStats = (
	// Générique de points relâché (`any`) : accepte aussi bien les points
	// { x: Date; y: number } du temps réel que la forme par défaut de Chart.js.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	chartData: Ref<ChartData<"line", any>> | ComputedRef<ChartData<"line", any>>
): ComputedRef<MeasureStat[]> =>
	computed(() => {
		const datasets = chartData.value?.datasets ?? []
		return (
			datasets
				// On ignore les datasets de seuils (MIN/MAX en pointillés).
				.filter(ds => !(ds as { _isThreshold?: boolean })._isThreshold)
				.map(ds => {
					const label = String(ds.label ?? "")
					const points = (ds.data ?? []) as unknown as Point[]
					const ys = points.map(p => (typeof p === "object" && p !== null ? p.y : (p as unknown as number))).filter((y): y is number => typeof y === "number" && !isNaN(y))
					const count = ys.length
					if (count === 0) {
						return { label, unit: unitFor(label), current: null, min: null, max: null, avg: null, count: 0 }
					}
					let min = ys[0]
					let max = ys[0]
					let sum = 0
					for (const y of ys) {
						if (y < min) min = y
						if (y > max) max = y
						sum += y
					}
					return {
						label,
						unit: unitFor(label),
						current: ys[count - 1],
						min,
						max,
						avg: sum / count,
						count,
					}
				})
		)
	})
