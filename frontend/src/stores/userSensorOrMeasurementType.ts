import { ref } from "vue"
import { defineStore } from "pinia"
import useUserSensorOrMeasurementType from "@/composables/useUserSensorOrMeasurementType.composable"
import type { UserSensorAccess } from "#/userSensor"

export const useUserSensorOrMeasurementTypeStore = defineStore("userSensor", () => {
	const userSensorAccess = ref<UserSensorAccess[]>([])

	const getUserSensorAccess = () => {
		return userSensorAccess.value
	}

	const refresh = async () => {
		const res = await useUserSensorOrMeasurementType().getAllUserSensorAccess()
		userSensorAccess.value = res.data!
	}
	return { getUserSensorAccess, refresh }
})
