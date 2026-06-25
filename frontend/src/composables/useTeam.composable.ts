import { ref } from "vue"
import type { Team } from "#/team"
import { useAxios } from "@/composables/useAxios.composable"

/**
 * Gestion des teams (groupes d'utilisateurs) et de leurs membres.
 * Les grants d'accès team→zone se font via useZone (endpoints /zones/:id/access).
 */
export const useTeam = () => {
	const { axios } = useAxios()

	const teams = ref<Team[]>([])

	const fetchTeams = async () => {
		const { data } = await axios.get<Team[]>("/teams")
		teams.value = data
		return data
	}

	const fetchTeam = async (id: string) => {
		const { data } = await axios.get<Team>(`/teams/${id}`)
		return data
	}

	const createTeam = async (name: string) => {
		const { data } = await axios.post<Team>("/teams", { name })
		return data
	}

	const updateTeam = async (id: string, name: string) => {
		const { data } = await axios.put<Team>(`/teams/${id}`, { name })
		return data
	}

	const deleteTeam = async (id: string) => {
		await axios.delete(`/teams/${id}`)
	}

	const addMember = async (teamId: string, userId: string) => {
		await axios.post(`/teams/${teamId}/members`, { userId })
	}

	const removeMember = async (teamId: string, userId: string) => {
		await axios.delete(`/teams/${teamId}/members/${userId}`)
	}

	return { teams, fetchTeams, fetchTeam, createTeam, updateTeam, deleteTeam, addMember, removeMember }
}
