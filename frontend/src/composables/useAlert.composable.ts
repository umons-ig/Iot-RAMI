import { ref, computed } from "vue"
import type { ThresholdAlert } from "@/composables/useThreshold.composable"

const alerts = ref<ThresholdAlert[]>([])

const useAlert = () => {
	const alertCount = computed(() => new Set(alerts.value.map(a => a.sensorTopic)).size)

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const listenToAlerts = (socket: any) => {
		socket.on("threshold-alert", (alert: ThresholdAlert) => {
			alerts.value.unshift(alert)
		})
	}

	const clearAlerts = () => {
		alerts.value = []
	}

	return { alerts, alertCount, listenToAlerts, clearAlerts }
}

export { useAlert }
