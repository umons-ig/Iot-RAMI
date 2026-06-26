import { ref } from "vue"
import { useAxios } from "@/composables/useAxios.composable"
import { useSocket } from "@/composables/useSocket.composable"
import type { Session } from "#/session"
import { UserFields, EventTypes, handleEvent } from "@/composables/useUser.composable"
import type { ChartData } from "chart.js"

enum SessionControllerPaths {
	START_SESSION_ON_CLIENT_SIDE = "sessions/new",
	COMPLETE_SESSION_ON_SERVER_SIDE = "sessions/new/on/server",
	GET_ACTIVE_SESSIONS = "sessions/active",
	SESSION_DATA = "sessions/:id/data", // id must be replaced by that of the session
	GET_USER_SESSIONS = "users/:userId/sessions",
	GET_USER_SESSIONS_ON_A_SENSOR = "users/:userId/sessions/on/sensor/:sensorId",
	GET_SENSOR_SESSIONS = "sensors/:sensorId/sessions",
	EXPORT_SESSION_CSV = "sessions/:id/export/csv",
	GET_SESSION_AGGREGATE = "sessions/:id/aggregate",
}

const getCorrectUrl = (url: string, parameterToReplace: string, parameterValue: string | null): string => {
	if (parameterValue) {
		return url.replace(parameterToReplace, parameterValue)
	}
	return ""
}

const getURLForFetchingSessionData = (idSession: string): string => {
	return getCorrectUrl(SessionControllerPaths.SESSION_DATA, ":id", idSession)
}

const getURLForFetchingUserSessions = (idUser: string | null): string => {
	return getCorrectUrl(SessionControllerPaths.GET_USER_SESSIONS, ":userId", idUser)
}

const getURLForFetchingSensorSessions = (idSensor: string | null): string => {
	return getCorrectUrl(SessionControllerPaths.GET_SENSOR_SESSIONS, ":sensorId", idSensor)
}

const getURLForFetchingUserSessionsOnASensor = (idUser: string, idSensor: string) => {
	const firstReplacement = getCorrectUrl(SessionControllerPaths.GET_USER_SESSIONS_ON_A_SENSOR, ":sensorId", idSensor)
	return firstReplacement.replace(":userId", idUser)
}

const getURLForExportingSessionAsCsv = (idSession: string): string => {
	return getCorrectUrl(SessionControllerPaths.EXPORT_SESSION_CSV, ":id", idSession)
}

const getURLForGettingSessionAggregate = (idSession: string): string => {
	return getCorrectUrl(SessionControllerPaths.GET_SESSION_AGGREGATE, ":id", idSession)
}

const useDistributionSessionBySensor = () => {
	const { axios } = useAxios()

	// **************************************************** ATTRIBUTES ****************************************************
	// *************************** [ATTRIBUTE]  Distribution of your sessions by sensor
	const chartDataSessionDistribution = ref<ChartData<"bar">>({
		labels: [],
		datasets: [
			{
				label: "Sessions number ",
				backgroundColor: "rgba(75, 192, 192, 0.5)",
				borderColor: "rgba(75, 192, 192, 1)",
				data: [],
			},
		],
	})
	const averageDuration = ref(0)

	// **************************************************** METHODS ****************************************************
	// *************************** [ATTRIBUTE]  Distribution of your sessions by sensor

	const fetchSessionsBySensor = async () => {
		try {
			const userId = localStorage.getItem(UserFields.ID)
			const { data } = await axios.get(getURLForFetchingUserSessions(userId))
			const sessionList: any[] = data.sessions ?? data

			const sensorCounts = sessionList.reduce((acc: any, session: any) => {
				acc[session.idSensor] = (acc[session.idSensor] || 0) + 1
				return acc
			}, {})

			const newLabels = Object.keys(sensorCounts)
			const newData = Object.values(sensorCounts) as (number | [number, number] | null)[]

			updateBarChartWithNewValues(newLabels, newData)

			const totalDuration = sessionList.reduce((acc: number, session: any) => {
				const start = new Date(session.createdAt).getTime()
				const end = new Date(session.endedAt).getTime()
				return acc + (end - start)
			}, 0)

			averageDuration.value = totalDuration / sessionList.length / 60000 // Convertir en minutes
		} catch (error) {
			console.error("Erreur lors de la récupération des sessions par capteur:", error)
		}
	}

	const updateBarChartWithNewValues = (newLabels: string[], newData: (number | [number, number] | null)[]) => {
		chartDataSessionDistribution.value.labels = newLabels
		chartDataSessionDistribution.value.datasets[0].data = newData
	}

	return {
		chartDataSessionDistribution,
		averageDuration,
		fetchSessionsBySensor,
	}
}

const useSession = () => {
	const { axios } = useAxios()
	const { createSocket } = useSocket()

	// **************************************************** ATTRIBUTES ****************************************************
	// *************************** [ATTRIBUTE]  LIST OF SESSIONS AND SELECTED SESSION
	const sessions = ref<Session[]>([])
	const selectedSession = ref<string | null>(null)

	// *************************** [ATTRIBUTE]  SESSION
	const idSensor = ref("")
	const idSession = ref("")
	const createdAt = ref<Date | null>(null)
	const endedAt = ref<Date | null>(null)

	// *************************** [ATTRIBUTE]  WebSocket
	const topic = ref("")
	const socketClient = ref<any>(null)

	// *************************** [ATTRIBUTE]  GRAPH SESSION (both realtime and non realtime)
	const chartData = ref<ChartData<"line", { x: Date; y: number }[]>>({
		labels: [],
		datasets: [],
	})

	// *************************** [ATTRIBUTE]  EXTRA INFORMATION (for realtime graph)
	const timeSinceLastValue = ref(0)
	const transmissionSpeed = ref(0)
	const lastMessageTime = ref<Date | null>(null)
	// État de connexion temps réel exposé à l'UI (badge LIVE / RECONNEXION…).
	// Cf. PLAN_AMELIORATIONS §1.6.
	const connectionState = ref<"connected" | "reconnecting" | "disconnected">("disconnected")
	// Gel de l'affichage temps réel : quand `paused`, on cesse d'alimenter le
	// graphe (le socket continue de tourner) pour inspecter la fenêtre courante.
	const paused = ref(false)
	const togglePause = () => {
		paused.value = !paused.value
	}

	// **************************************************** METHODS ****************************************************
	// *************************** [ATTRIBUTE]  LIST OF SESSIONS AND SELECTED SESSION

	const handleFetchSessionData = (session: { id: string; startDate: string; endDate: string }) => {
		fetchDataAndUpdateChart(session.id)
	}

	const fetchAllSessionsOfSensor = async (sensorId: string) => {
		try {
			const response = await axios.get(getURLForFetchingSensorSessions(sensorId))
			const payload = response.data
			sessions.value = Array.isArray(payload) ? payload : payload.data
		} catch (error) {
			console.error("Error fetching sessions:", error)
		}
	}

	const fetchAllSessionsOfUser = async (userId: string) => {
		try {
			const response = await axios.get(getURLForFetchingUserSessions(userId))
			const payload = response.data
			sessions.value = payload.sessions ?? payload // Mettre à jour les sessions avec les données de l'API
		} catch (error) {
			console.error("Error fetching sessions:", error)
		}
	}

	const fetchUserSessionsOnASensor = async ({ idUser, idSensor }: { idUser: string; idSensor: string }) => {
		try {
			const response = await axios.get(getURLForFetchingUserSessionsOnASensor(idUser, idSensor))
			sessions.value = response.data // Mettre à jour les sessions avec les données de l'API
		} catch (error) {
			console.error("Error fetching sessions:", error)
		}
	}

	const handleSessionSelect = (sessionId: string) => {
		selectedSession.value = sessionId
		const session = sessions.value.find(s => s.id === sessionId)
		if (session) {
			handleEvent("emit", EventTypes.SESSION_SELECTED, {
				id: session.id,
				startDate: session.createdAt,
				endDate: session.endedAt,
			})
		}
	}

	const registerOrRemoveEventHandlers = (action: "on" | "off") => {
		handleEvent(action, EventTypes.SENSOR_SELECTED_FOR_FETCHING_SESSIONS, fetchAllSessionsOfSensor)
		handleEvent(action, EventTypes.USER_SELECTED_FOR_FETCHING_SESSIONS, fetchAllSessionsOfUser)
		handleEvent(action, EventTypes.USER_REQUEST_SESSION_BY_SENSOR, fetchUserSessionsOnASensor)
		handleEvent(action, EventTypes.SESSION_SELECTED, handleFetchSessionData)
	}

	// *************************** [METHOD]  SESSION

	const startSessionOnClientSide = (sensorTopic: string, sensorId: string) => {
		setupSession(sensorId, sensorTopic, new Date())
		connectToWebSocket(sensorTopic)
	}

	const checkAndJoinActiveSession = async (sensorId: string, sensorTopic: string): Promise<boolean> => {
		try {
			const { data } = await axios.get(SessionControllerPaths.GET_ACTIVE_SESSIONS)
			const activeSession = data.find((s: any) => s.idSensor === sensorId)
			if (activeSession) {
				startSessionOnClientSide(sensorTopic, sensorId)
				await fetchDataAndUpdateChart(activeSession.id)
				return true
			}
			return false
		} catch (error) {
			console.error("Erreur vérification session active:", error)
			return false
		}
	}

	const createSessionOnServerSide = () => {
		endSession()
	}

	const endSession = () => {
		socketClient.value?.off("new-data")
		socketClient.value?.disconnect()
		connectionState.value = "disconnected"
		cleanAfterSession()
	}

	const setupSession = (sensorId: string, sessionTopic: string, sessionCreatedAt: Date) => {
		idSensor.value = sensorId
		topic.value = sessionTopic
		createdAt.value = sessionCreatedAt
	}

	const cleanAfterSession = () => {
		idSession.value = ""
		topic.value = ""
		createdAt.value = null
		endedAt.value = null
	}
	const connectToWebSocket = (topic: string) => {
		if (socketClient.value) {
			socketClient.value.off("new-data")
			socketClient.value.disconnect()
			socketClient.value = null
		}
		const socket = createSocket()
		socketClient.value = socket

		// On (ré)émet join-session à CHAQUE (re)connexion : socket.io reconnecte
		// tout seul après une coupure réseau/redémarrage backend, mais sans
		// re-join le client ne recevait plus aucune donnée (room perdue). On lit
		// le token au moment du join (il a pu être rafraîchi). Cf. §1.6.
		const joinSession = () => {
			const token = localStorage.getItem(UserFields.TOKEN)
			socket.emit("join-session", { topic, token })
		}
		// Join initial (bufferisé par socket.io jusqu'à la connexion)…
		joinSession()
		// …puis re-join à chaque (re)connexion.
		socket.on("connect", () => {
			connectionState.value = "connected"
			joinSession()
		})
		socket.on("disconnect", () => {
			connectionState.value = "reconnecting"
		})
		socket.on("connect_error", () => {
			connectionState.value = "reconnecting"
		})
		// `socket.io` est le Manager (présent sur le vrai client, optionnel ici
		// pour rester robuste aux mocks de test).
		socket.io?.on?.("reconnect_attempt", () => {
			connectionState.value = "reconnecting"
		})

		socket.on("new-data", (data: any) => {
			try {
				if (!Array.isArray(data.measures)) return
				data.measures.forEach((entry: any) => {
					const date = new Date(Math.floor(entry.timestamp / 1000))
					if (Array.isArray(entry.measures)) {
						entry.measures.forEach((measure: { measureType: string; value: number }) => {
							if (!isNaN(measure.value)) {
								updateChart(date, parseFloat(String(measure.value)), measure.measureType)
							}
						})
						updateTransmissionSpeed(date)
					}
				})
			} catch (error) {
				console.error("Error processing WebSocket data:", error)
			}
		})

		return socket
	}
	// *************************** [METHOD]  GRAPH SESSION (both realtime and non realtime)

	const DATASET_COLORS = [
		{ bg: "rgba(75, 192, 192, 0.5)", border: "rgba(75, 192, 192, 1)" },
		{ bg: "rgba(255, 99, 132, 0.5)", border: "rgba(255, 99, 132, 1)" },
		{ bg: "rgba(54, 162, 235, 0.5)", border: "rgba(54, 162, 235, 1)" },
		{ bg: "rgba(255, 206, 86, 0.5)", border: "rgba(255, 206, 86, 1)" },
	]

	const updateChart = (label: Date, value: number, measureType: string, maxpoint = 100) => {
		// Gel : on ignore les nouveaux points tant que l'affichage est en pause
		// (le flux WebSocket continue, mais le graphe reste figé pour inspection).
		if (paused.value) return
		// Mutation IN-PLACE (cf. PLAN_AMELIORATIONS §2.1). L'ancienne version
		// recopiait tous les labels + tous les datasets ET re-triait tout le
		// tableau À CHAQUE point (O(n log n) pour rien, les points arrivent déjà
		// chronologiques) — soit ~400 copies+tris/s à 100 Hz × 4 mesures. Ici on
		// push en place et on ne réassigne que le wrapper de premier niveau (O(1))
		// pour déclencher la mise à jour de vue-chartjs sans recopier les tableaux.
		const data = chartData.value as ChartData<"line", { x: Date; y: number }[]>
		if (!data.labels) data.labels = []
		const labels = data.labels as string[]
		labels.push(label.toISOString())

		let dataset = data.datasets.find(d => d.label === measureType)
		if (!dataset) {
			const color = DATASET_COLORS[data.datasets.length % DATASET_COLORS.length]
			dataset = {
				label: measureType,
				backgroundColor: color.bg,
				borderColor: color.border,
				fill: false,
				data: [],
			}
			data.datasets.push(dataset)
		}

		dataset.data.push({ x: label, y: value })
		// Plus de tri : les mesures arrivent déjà dans l'ordre temporel.
		if (maxpoint > 0 && dataset.data.length > maxpoint) dataset.data.shift()
		if (maxpoint > 0 && labels.length > maxpoint) labels.shift()

		// Réassigne uniquement le conteneur (mêmes références de tableaux) ->
		// vue-chartjs détecte le changement et appelle chart.update() sans copie.
		chartData.value = { labels, datasets: data.datasets }
	}

	const fetchDataAndUpdateChart = async (idSession: string) => {
		try {
			chartData.value = { labels: [], datasets: [] }
			const response = await axios.get(`${getURLForFetchingSessionData(idSession)}?maxPoints=1000`)
			const sessionData: { time: string; value: number; MeasurementType?: { name: string } }[] = response.data

			// Build all datasets in memory first, then assign once
			const labels: string[] = []
			const datasetsMap = new Map<string, { x: Date; y: number }[]>()

			for (const point of sessionData) {
				const measureType = point.MeasurementType?.name || "Unknown"
				const date = new Date(point.time)
				labels.push(date.toISOString())
				if (!datasetsMap.has(measureType)) datasetsMap.set(measureType, [])
				datasetsMap.get(measureType)!.push({ x: date, y: parseFloat(String(point.value)) })
			}

			const datasets = Array.from(datasetsMap.entries()).map(([label, data], i) => {
				const color = DATASET_COLORS[i % DATASET_COLORS.length]
				return { label, data, fill: false, backgroundColor: color.bg, borderColor: color.border }
			})

			chartData.value = { labels, datasets }
		} catch (error) {
			console.error("Error fetching data", error)
		}
	}

	// *************************** [METHOD]  EXTRA INFORMATION (for realtime graph)

	const updateTransmissionSpeed = (currentTime: Date) => {
		if (lastMessageTime.value) {
			const timeDiff = (currentTime.getTime() - lastMessageTime.value.getTime()) / 1000
			timeSinceLastValue.value = timeDiff
			if (timeDiff > 0) {
				transmissionSpeed.value = 1 / timeDiff
			}
		}
		lastMessageTime.value = currentTime
	}

	const exportSessionToCsv = async (sessionId: string) => {
		try {
			const url = getURLForExportingSessionAsCsv(sessionId)
			const response = await axios.get(url, { responseType: "blob" })
			const blobUrl = URL.createObjectURL(response.data)
			const link = document.createElement("a")
			link.href = blobUrl
			link.download = `session-${sessionId}.csv`
			link.click()
			URL.revokeObjectURL(blobUrl)
		} catch (error) {
			console.error("Error exporting session to CSV:", error)
		}
	}

	const fetchAggregateData = async (sessionId: string) => {
		try {
			const url = getURLForGettingSessionAggregate(sessionId)
			const response = await axios.get(url)
			return response.data
		} catch (error) {
			console.error("Error fetching session aggregate data:", error)
			return null
		}
	}

	return {
		idSensor,
		idSession,
		topic,
		chartData,
		timeSinceLastValue,
		transmissionSpeed,
		connectionState,
		lastMessageTime,
		paused,
		togglePause,
		startSessionOnClientSide,
		createSessionOnServerSide,
		checkAndJoinActiveSession,
		fetchDataAndUpdateChart,
		fetchAllSessionsOfSensor,
		sessions,
		selectedSession,
		handleSessionSelect,
		registerOrRemoveEventHandlers,
		exportSessionToCsv,
		endSession,
		fetchAggregateData,
	}
}
export { useDistributionSessionBySensor, useSession }
