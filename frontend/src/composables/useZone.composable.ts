import { ref } from "vue"
import type { Zone, ZoneTreeNode } from "#/zone"
import type { Sensor } from "#/sensor"
import type { ZoneAccess } from "#/team"
import { useAxios } from "@/composables/useAxios.composable"

/**
 * Gestion des zones hiérarchiques (entreprise > bâtiment > étage > pièce > …).
 * S'appuie sur l'API `/zones` du backend (arbre récursif, affectation capteurs).
 */
export const useZone = () => {
	const { axios } = useAxios()

	const tree = ref<ZoneTreeNode[]>([])
	const zonesFlat = ref<Zone[]>([])
	const zoneSensors = ref<Sensor[]>([])
	const loading = ref(false)
	const error = ref<string | null>(null)

	const fetchTree = async () => {
		loading.value = true
		error.value = null
		try {
			const { data } = await axios.get<ZoneTreeNode[]>("/zones/tree")
			tree.value = data
		} catch (e) {
			error.value = "Impossible de charger l'arbre des zones."
			throw e
		} finally {
			loading.value = false
		}
	}

	const fetchFlat = async () => {
		const { data } = await axios.get<Zone[]>("/zones")
		zonesFlat.value = data
		return data
	}

	const fetchZoneSensors = async (zoneId: string) => {
		const { data } = await axios.get<Sensor[]>(`/zones/${zoneId}/sensors`)
		zoneSensors.value = data
		return data
	}

	const createZone = async (payload: { name: string; type?: string | null; parentId?: string | null }) => {
		const { data } = await axios.post<Zone>("/zones", payload)
		return data
	}

	const updateZone = async (id: string, payload: Partial<Pick<Zone, "name" | "type" | "parentId">>) => {
		const { data } = await axios.put<Zone>(`/zones/${id}`, payload)
		return data
	}

	const deleteZone = async (id: string, cascade = false) => {
		await axios.delete(`/zones/${id}`, { params: cascade ? { cascade: "true" } : {} })
	}

	/** Rattache un capteur à une zone, ou le détache si zoneId est null. */
	const assignSensor = async (sensorId: string, zoneId: string | null) => {
		const target = zoneId ?? "none"
		const { data } = await axios.put<Sensor>(`/zones/${target}/sensors`, { sensorId })
		return data
	}

	// ── Accès à une zone (users + teams), accordé en cascade sur le sous-arbre ──
	const fetchZoneAccess = async (zoneId: string): Promise<ZoneAccess> => {
		const { data } = await axios.get<ZoneAccess>(`/zones/${zoneId}/access`)
		return data
	}

	const grantZoneAccess = async (zoneId: string, target: { userId?: string; teamId?: string }) => {
		await axios.post(`/zones/${zoneId}/access`, target)
	}

	const revokeZoneAccess = async (zoneId: string, target: { userId?: string; teamId?: string }) => {
		await axios.delete(`/zones/${zoneId}/access`, { data: target })
	}

	return {
		tree,
		zonesFlat,
		zoneSensors,
		loading,
		error,
		fetchTree,
		fetchFlat,
		fetchZoneSensors,
		createZone,
		updateZone,
		deleteZone,
		assignSensor,
		fetchZoneAccess,
		grantZoneAccess,
		revokeZoneAccess,
	}
}
