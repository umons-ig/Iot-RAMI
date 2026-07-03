import { ref } from "vue"
import type { ChartData } from "chart.js"
import { useAxios } from "@/composables/useAxios.composable"
import type { Sensor } from "#/sensor"

// Comparaison multi-capteurs par zone (PLAN_AMELIORATIONS lot C).
// Permet de voir ensemble les capteurs d'une zone et, en mode « superposé »,
// de comparer ceux qui mesurent la même chose (ex. plusieurs températures) sur
// un seul graphe ; en mode « divisé », un graphe par capteur.
//
// Cette première itération s'appuie sur la DERNIÈRE session de chaque capteur
// (historique). Le live multi-rooms est une évolution ultérieure.

const PHOSPHOR_COLORS = ["#ff9f0a", "#39ff14", "#00cfff", "#ff4f80", "#ffcc00", "#b388ff", "#7CFC00", "#ff6e40"]

export interface RawPoint {
	time: string
	value: number
	MeasurementType?: { name: string } | null
}

export interface SensorSeries {
	sensorId: string
	sensorName: string
	points: RawPoint[]
}

type LinePoint = { x: number; y: number }

/** Types de mesure présents dans l'ensemble des séries (union triée). */
export const collectMeasureTypes = (seriesList: SensorSeries[]): string[] => {
	const set = new Set<string>()
	for (const s of seriesList) {
		for (const p of s.points) set.add(p.MeasurementType?.name ?? "valeur")
	}
	return Array.from(set).sort()
}

/** Plus petit timestamp (origine commune) sur l'ensemble des séries, en ms. */
export const globalOrigin = (seriesList: SensorSeries[]): number => {
	let min = Infinity
	for (const s of seriesList) {
		for (const p of s.points) {
			const t = new Date(p.time).getTime()
			if (t < min) min = t
		}
	}
	return min === Infinity ? 0 : min
}

/**
 * Mode SUPERPOSÉ : un dataset par capteur pour UN type de mesure donné, aligné
 * sur une origine commune (axe temps relatif partagé) → comparaison directe.
 */
export const buildOverlayChartData = (seriesList: SensorSeries[], measureType: string, originMs: number): ChartData<"line", LinePoint[]> => {
	const datasets = seriesList.map((s, i) => {
		const color = PHOSPHOR_COLORS[i % PHOSPHOR_COLORS.length]
		const data: LinePoint[] = s.points.filter(p => (p.MeasurementType?.name ?? "valeur") === measureType).map(p => ({ x: new Date(p.time).getTime() - originMs, y: Number(p.value) }))
		return {
			label: s.sensorName,
			data,
			borderColor: color,
			backgroundColor: color,
			fill: false,
		}
	})
	return { datasets }
}

/**
 * Mode DIVISÉ : pour UN capteur, un dataset par type de mesure (axe relatif au
 * premier point du capteur).
 */
export const buildSplitChartData = (series: SensorSeries): ChartData<"line", LinePoint[]> => {
	const origin = series.points.length ? new Date(series.points[0].time).getTime() : 0
	const byType = new Map<string, LinePoint[]>()
	for (const p of series.points) {
		const type = p.MeasurementType?.name ?? "valeur"
		if (!byType.has(type)) byType.set(type, [])
		byType.get(type)!.push({ x: new Date(p.time).getTime() - origin, y: Number(p.value) })
	}
	const datasets = Array.from(byType.entries()).map(([label, data], i) => {
		const color = PHOSPHOR_COLORS[i % PHOSPHOR_COLORS.length]
		return { label, data, borderColor: color, backgroundColor: color, fill: false }
	})
	return { datasets }
}

export const useZoneComparison = () => {
	const { axios } = useAxios()

	const series = ref<SensorSeries[]>([])
	const loading = ref(false)
	const errorMsg = ref("")

	// Récupère, pour chaque capteur, les points de sa dernière session.
	const loadZoneSeries = async (sensors: Sensor[]) => {
		loading.value = true
		errorMsg.value = ""
		try {
			const results = await Promise.all(
				sensors.map(async sensor => {
					try {
						const sessionsRes = await axios.get(`sensors/${sensor.id}/sessions`)
						const payload = sessionsRes.data
						const list = Array.isArray(payload) ? payload : payload.data ?? []
						if (!list.length) return { sensorId: sensor.id, sensorName: sensor.name, points: [] }
						// La plus récente (l'API trie par date desc).
						const latest = list[0]
						const dataRes = await axios.get(`sessions/${latest.id}/data?maxPoints=1000`)
						return { sensorId: sensor.id, sensorName: sensor.name, points: dataRes.data ?? [] }
					} catch {
						return { sensorId: sensor.id, sensorName: sensor.name, points: [] }
					}
				})
			)
			series.value = results
		} catch (err) {
			console.error("useZoneComparison — loadZoneSeries:", err)
			errorMsg.value = "Erreur lors du chargement des séries de la zone."
		} finally {
			loading.value = false
		}
	}

	return {
		series,
		loading,
		errorMsg,
		loadZoneSeries,
		collectMeasureTypes,
		globalOrigin,
		buildOverlayChartData,
		buildSplitChartData,
	}
}
