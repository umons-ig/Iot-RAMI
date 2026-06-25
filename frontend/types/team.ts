interface TeamMemberUser {
	id: string
	firstName: string
	lastName: string
	email: string
}

interface TeamZone {
	id: string
	name: string
	type: string | null
}

interface Team {
	id: string
	name: string
	members?: TeamMemberUser[]
	zones?: TeamZone[]
}

/** Accès direct à une zone (GET /zones/:id/access). */
interface ZoneAccess {
	users: TeamMemberUser[]
	teams: { id: string; name: string }[]
}

export type { Team, TeamMemberUser, TeamZone, ZoneAccess }
