interface Zone {
	id: string
	name: string
	type: string | null
	parentId: string | null
	createdAt?: string
	updatedAt?: string
}

/** Nœud renvoyé par GET /zones/tree (arbre imbriqué + compteur de capteurs directs). */
interface ZoneTreeNode {
	id: string
	name: string
	type: string | null
	parentId: string | null
	sensorCount: number
	children: ZoneTreeNode[]
}

export type { Zone, ZoneTreeNode }
