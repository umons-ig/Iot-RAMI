import { ref } from "vue"
import { useAxios } from "@/composables/useAxios.composable"
import type { Sensor } from "#/sensor"
import type { Session } from "#/session"
import type { ChartData, ChartDataset } from "chart.js"

// ────────────────────────────────────────────────────────────
//  Palette phosphore — identique à Graph.vue
// ────────────────────────────────────────────────────────────
const PHOSPHOR_COLORS = [
	"#ff9f0a", // Ambre
	"#39ff14", // Vert
	"#00cfff", // Cyan
	"#ff4f80", // Rose
	"#ffcc00", // Jaune
	"#bf5af2", // Violet
	"#30d158", // Vert clair
	"#64d2ff", // Bleu ciel
	"#ff6961", // Saumon
	"#da8fff", // Lilas
]

// ────────────────────────────────────────────────────────────
//  Types internes
// ────────────────────────────────────────────────────────────

interface RawDataPoint {
	time: string
	value: number
	MeasurementType?: { name: string }
}

// Dataset Chart.js pour la comparaison (axe X = ms relatifs)
type ComparisonDataset = ChartDataset<"line", { x: number; y: number }[]>

export interface ComparableThreshold {
	minValue?: number | null
	maxValue?: number | null
}

/** Formate une durée en ms de façon lisible (« 12m 30s », « 45s »). */
export const formatDuration = (ms: number): string => {
	if (!Number.isFinite(ms) || ms < 0) return "—"
	const totalSeconds = Math.round(ms / 1000)
	const m = Math.floor(totalSeconds / 60)
	const s = totalSeconds % 60
	if (m === 0) return `${s}s`
	return s === 0 ? `${m}m` : `${m}m ${s}s`
}

/**
 * Lignes de seuil horizontales (MIN/MAX) couvrant toute la plage temporelle
 * [0, maxX] — superposées aux courbes de comparaison (§D). Pointillés, couleurs
 * dédiées, exclues de la logique de stats côté graphe.
 */
export const buildThresholdLines = (thresholds: ComparableThreshold[], maxX: number): ComparisonDataset[] => {
	const lines: ComparisonDataset[] = []
	for (const t of thresholds) {
		if (t.maxValue !== null && t.maxValue !== undefined) {
			lines.push({
				label: "SEUIL MAX",
				data: [
					{ x: 0, y: t.maxValue },
					{ x: maxX, y: t.maxValue },
				],
				borderColor: "rgba(255,64,64,0.75)",
				backgroundColor: "transparent",
				borderDash: [6, 3],
				borderWidth: 1.5,
				pointRadius: 0,
				fill: false,
			} as ComparisonDataset)
		}
		if (t.minValue !== null && t.minValue !== undefined) {
			lines.push({
				label: "SEUIL MIN",
				data: [
					{ x: 0, y: t.minValue },
					{ x: maxX, y: t.minValue },
				],
				borderColor: "rgba(0,207,255,0.75)",
				backgroundColor: "transparent",
				borderDash: [6, 3],
				borderWidth: 1.5,
				pointRadius: 0,
				fill: false,
			} as ComparisonDataset)
		}
	}
	return lines
}

// ────────────────────────────────────────────────────────────
//  Paths API
// ────────────────────────────────────────────────────────────

enum HistoryAPIPath {
	GET_ALL_SENSORS = "/sensors",
	GET_SENSOR_SESSIONS = "/sensors/:sensorId/sessions",
	GET_SESSION_DATA = "/sessions/:id/data",
}

const buildSensorSessionsUrl = (sensorId: string) => HistoryAPIPath.GET_SENSOR_SESSIONS.replace(":sensorId", sensorId)

const buildSessionDataUrl = (sessionId: string) => HistoryAPIPath.GET_SESSION_DATA.replace(":id", sessionId)

// ────────────────────────────────────────────────────────────
//  Composable
// ────────────────────────────────────────────────────────────

export const useHistoryComparison = () => {
	const { axios } = useAxios()

	// ── State ──────────────────────────────────────────────

	const sensors = ref<Sensor[]>([])
	const sessions = ref<Session[]>([])
	const comparisonData = ref<ChartData<"line", { x: number; y: number }[]> | null>(null)

	const loadingSensors = ref(false)
	const loadingSessions = ref(false)
	const loadingGraph = ref(false)
	const errorMsg = ref("")
	// Capteur courant (pour récupérer ses seuils à superposer). §D
	const currentSensorId = ref<string | null>(null)

	// ── API calls ──────────────────────────────────────────

	const fetchSensors = async () => {
		loadingSensors.value = true
		errorMsg.value = ""
		try {
			const response = await axios.get(HistoryAPIPath.GET_ALL_SENSORS)
			const payload = response.data
			sensors.value = Array.isArray(payload) ? payload : payload.data ?? []
		} catch (err) {
			console.error("useHistoryComparison — fetchSensors:", err)
			errorMsg.value = "IMPOSSIBLE DE CHARGER LES CAPTEURS"
		} finally {
			loadingSensors.value = false
		}
	}

	const fetchSessionsForSensor = async (sensorId: string) => {
		loadingSessions.value = true
		errorMsg.value = ""
		sessions.value = []
		currentSensorId.value = sensorId
		try {
			const response = await axios.get(buildSensorSessionsUrl(sensorId), {
				params: { page: 1, limit: 50 },
			})
			const payload = response.data
			sessions.value = Array.isArray(payload) ? payload : payload.data ?? []
		} catch (err) {
			console.error("useHistoryComparison — fetchSessionsForSensor:", err)
			errorMsg.value = "IMPOSSIBLE DE CHARGER LES SESSIONS"
		} finally {
			loadingSessions.value = false
		}
	}

	const fetchSessionData = async (sessionId: string): Promise<RawDataPoint[]> => {
		const response = await axios.get(`${buildSessionDataUrl(sessionId)}?maxPoints=1000`)
		return response.data as RawDataPoint[]
	}

	// ── Dataset builder ────────────────────────────────────

	/**
	 * Construit les datasets Chart.js pour la comparaison.
	 *
	 * Convention :
	 *   - Couleur indexée par numéro de session (position dans selectedSessionIds)
	 *   - Axe X = millisecondes depuis le début de la session (temps relatif T+0)
	 *   - Premier type de mesure rencontré → trait plein (borderDash: undefined)
	 *   - Types suivants → pointillés [5,5]
	 */
	const buildComparisonDatasets = async (selectedSessionIds: string[]) => {
		if (selectedSessionIds.length === 0) {
			comparisonData.value = null
			return
		}

		loadingGraph.value = true
		errorMsg.value = ""

		try {
			// Récupérer les données brutes de chaque session en parallèle
			const allRawData = await Promise.all(selectedSessionIds.map(id => fetchSessionData(id)))

			const datasets: ComparisonDataset[] = []

			allRawData.forEach((rawPoints, sessionIndex) => {
				const sessionColor = PHOSPHOR_COLORS[sessionIndex % PHOSPHOR_COLORS.length]
				// Libellé enrichi de la durée réelle (aide à interpréter le recalage
				// T+0 quand les sessions ont des durées très différentes). §D
				const sessionId = selectedSessionIds[sessionIndex]
				const meta = sessions.value.find(s => s.id === sessionId)
				let sessionLabel = `S${sessionIndex + 1}`
				if (meta?.createdAt && meta?.endedAt) {
					const dur = new Date(meta.endedAt).getTime() - new Date(meta.createdAt).getTime()
					sessionLabel = `S${sessionIndex + 1} (${formatDuration(dur)})`
				}

				// Regrouper les points par type de mesure
				const byMeasureType = new Map<string, { time: number; value: number }[]>()

				// Calculer l'origine temporelle (premier timestamp de la session)
				if (rawPoints.length === 0) return

				const originMs = new Date(rawPoints[0].time).getTime()

				for (const point of rawPoints) {
					const measureType = point.MeasurementType?.name ?? "valeur"
					const relativeMs = new Date(point.time).getTime() - originMs
					if (!byMeasureType.has(measureType)) {
						byMeasureType.set(measureType, [])
					}
					byMeasureType.get(measureType)!.push({ time: relativeMs, value: point.value })
				}

				// Créer un dataset par type de mesure
				const measureTypes = Array.from(byMeasureType.keys())
				measureTypes.forEach((measureType, typeIndex) => {
					const points = byMeasureType.get(measureType)!
					const isDashed = typeIndex > 0

					datasets.push({
						label: `${sessionLabel} — ${measureType}`,
						data: points.map(p => ({ x: p.time, y: parseFloat(String(p.value)) })),
						borderColor: sessionColor,
						backgroundColor: sessionColor + "14", // 8% opacité
						borderWidth: 1.5,
						borderDash: isDashed ? [5, 5] : undefined,
						fill: false,
						pointRadius: 0,
						pointHitRadius: 8,
						pointHoverRadius: 3,
						tension: 0.2,
					} as ComparisonDataset)
				})
			})

			// Superposition des seuils du capteur (lignes horizontales). §D
			if (currentSensorId.value && datasets.length) {
				let maxX = 0
				for (const ds of datasets) {
					const last = ds.data[ds.data.length - 1]
					if (last && last.x > maxX) maxX = last.x
				}
				try {
					const res = await axios.get(`/thresholds/sensor/${currentSensorId.value}`)
					const thresholds = Array.isArray(res.data) ? res.data : []
					datasets.push(...buildThresholdLines(thresholds, maxX))
				} catch {
					// Pas de seuil (404) ou erreur : on n'ajoute simplement rien.
				}
			}

			comparisonData.value = { datasets }
		} catch (err) {
			console.error("useHistoryComparison — buildComparisonDatasets:", err)
			errorMsg.value = "ERREUR LORS DU CHARGEMENT DES DONNÉES"
			comparisonData.value = null
		} finally {
			loadingGraph.value = false
		}
	}

	return {
		// State
		sensors,
		sessions,
		comparisonData,
		loadingSensors,
		loadingSessions,
		loadingGraph,
		errorMsg,
		// Methods
		fetchSensors,
		fetchSessionsForSensor,
		buildComparisonDatasets,
	}
}
