import type { UserSensorAccess, UserSensorAccessUpdateResponse } from "#/userSensor"
import { useAxios } from "@/composables/useAxios.composable"
import { useUserSensorOrMeasurementTypeStore } from "@/stores/userSensorOrMeasurementType"

export interface ComposableResponse<T> {
	data: T | null
	error: string | null
	httpStatus: number | null
}

const useUserSensorOrMeasurementType = () => {
	const { axios } = useAxios()

	const handleErrors = (e: any): ComposableResponse<any> => {
		const httpStatus: number = e.response?.status || 500
		const { message, status } = e.response?.data ?? {}
		const messageClean = "Error " + (status ?? httpStatus) + " - " + message
		return { data: null, error: messageClean, httpStatus }
	}

	const getAllUserSensorAccess = async (): Promise<ComposableResponse<UserSensorAccess[]>> => {
		try {
			const { data } = await axios.get<UserSensorAccess[]>("/users/sensors/access?number=1000")
			return { data, error: null, httpStatus: 200 }
		} catch (e) {
			return handleErrors(e)
		}
	}

	const updateUserSensorAccess = async (user: string, sensor: string, banned: string): Promise<ComposableResponse<string>> => {
		try {
			const { data } = await axios.post<UserSensorAccessUpdateResponse>("/users/sensors/access", { userName: user, sensorName: sensor, banned: banned })
			await useUserSensorOrMeasurementTypeStore().refresh()
			return { data: data.message, error: null, httpStatus: 200 }
		} catch (e) {
			return handleErrors(e)
		}
	}

	const createUserSensorAccess = async (user: string, sensor: string): Promise<ComposableResponse<string>> => {
		try {
			const { data } = await axios.post<UserSensorAccessUpdateResponse>("/users/sensors/access/ask", { user: user, sensor: sensor })
			return { data: data.message, error: null, httpStatus: 200 }
		} catch (e) {
			return handleErrors(e)
		}
	}

	const submitForm = async (user: string, sensor: string, submitFunction: string): Promise<ComposableResponse<string>> => {
		switch (submitFunction) {
			case "sensor.access":
				return await createUserSensorAccess(user, sensor)
			default:
				return { data: null, error: "No function", httpStatus: 400 }
		}
	}

	return {
		getAllUserSensorAccess,
		updateUserSensorAccess,
		createUserSensorAccess,
		submitForm,
	}
}

export default useUserSensorOrMeasurementType
