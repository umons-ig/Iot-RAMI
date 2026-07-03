import { ref } from "vue"
import { useAxios } from "@/composables/useAxios.composable"

export interface Threshold {
	id: string
	idSensor: string
	idMeasurementType: string
	minValue?: number | null
	maxValue?: number | null
}

export interface ThresholdAlert {
	sensorTopic: string
	measureType: string
	value: number
	minValue?: number | null
	maxValue?: number | null
	direction: "min" | "max"
	triggeredAt: string
}

const useThreshold = () => {
	const { axios } = useAxios()
	const thresholds = ref<Threshold[]>([])
	const error = ref<string | null>(null)

	const fetchThresholdsBySensor = async (sensorId: string): Promise<void> => {
		error.value = null
		try {
			const { data } = await axios.get(`thresholds/sensor/${sensorId}`)
			thresholds.value = data
		} catch (err: any) {
			if (err?.response?.status === 404) {
				thresholds.value = []
			} else {
				error.value = "Impossible de charger les seuils"
			}
		}
	}

	const createThreshold = async (payload: { idSensor: string; idMeasurementType: string; minValue?: number | null; maxValue?: number | null }): Promise<Threshold | null> => {
		error.value = null
		try {
			const { data } = await axios.post("thresholds", payload)
			thresholds.value.push(data)
			return data
		} catch (err: any) {
			error.value = err?.response?.data?.error ?? "Impossible de créer le seuil"
			return null
		}
	}

	const updateThreshold = async (id: string, payload: { minValue?: number | null; maxValue?: number | null }): Promise<Threshold | null> => {
		error.value = null
		try {
			const { data } = await axios.put(`thresholds/${id}`, payload)
			const idx = thresholds.value.findIndex(t => t.id === id)
			if (idx !== -1) thresholds.value[idx] = data
			return data
		} catch (err: any) {
			error.value = err?.response?.data?.error ?? "Impossible de mettre à jour le seuil"
			return null
		}
	}

	const deleteThreshold = async (id: string): Promise<boolean> => {
		error.value = null
		try {
			await axios.delete(`thresholds/${id}`)
			thresholds.value = thresholds.value.filter(t => t.id !== id)
			return true
		} catch (err: any) {
			error.value = err?.response?.data?.error ?? "Impossible de supprimer le seuil"
			return false
		}
	}

	return { thresholds, error, fetchThresholdsBySensor, createThreshold, updateThreshold, deleteThreshold }
}

export { useThreshold }
