<script lang="ts" setup>
	import { ref, computed, onMounted } from "vue"
	import type { Team } from "#/team"
	import type { User } from "#/user"
	import { useTeam } from "@/composables/useTeam.composable"
	import { useUser } from "@/composables/useUser.composable"
	import { useToast } from "@/composables/useToast.composable"

	const { teams, fetchTeams, fetchTeam, createTeam, deleteTeam, addMember, removeMember } = useTeam()
	const { getAllUsers } = useUser()
	const toast = useToast()

	const allUsers = ref<User[]>([])
	const selected = ref<Team | null>(null)
	const newTeamName = ref("")
	const memberToAdd = ref("")

	onMounted(async () => {
		await Promise.all([
			fetchTeams(),
			getAllUsers()
				.then(u => (allUsers.value = u))
				.catch(() => undefined),
		])
	})

	async function selectTeam(team: Team) {
		selected.value = await fetchTeam(team.id)
		memberToAdd.value = ""
	}

	const addableUsers = computed(() => {
		const have = new Set((selected.value?.members ?? []).map(m => m.id))
		return allUsers.value.filter(u => !have.has(u.id))
	})

	async function create() {
		if (!newTeamName.value.trim()) {
			toast.warning("Nom requis", "Donne un nom à l'équipe.")
			return
		}
		try {
			await createTeam(newTeamName.value.trim())
			newTeamName.value = ""
			await fetchTeams()
			toast.success("Équipe créée", "")
		} catch {
			toast.danger("Échec", "Nom déjà pris ?")
		}
	}

	async function remove(team: Team) {
		if (!window.confirm(`Supprimer l'équipe « ${team.name} » ? (les accès de zone associés seront retirés)`)) return
		try {
			await deleteTeam(team.id)
			if (selected.value?.id === team.id) selected.value = null
			await fetchTeams()
			toast.success("Équipe supprimée", team.name)
		} catch {
			toast.danger("Échec", "Suppression impossible.")
		}
	}

	async function doAddMember() {
		if (!memberToAdd.value || !selected.value) return
		try {
			await addMember(selected.value.id, memberToAdd.value)
			memberToAdd.value = ""
			selected.value = await fetchTeam(selected.value.id)
			toast.success("Membre ajouté", "")
		} catch {
			toast.danger("Échec", "Ajout impossible.")
		}
	}

	async function dropMember(userId: string) {
		if (!selected.value) return
		await removeMember(selected.value.id, userId)
		selected.value = await fetchTeam(selected.value.id)
		toast.info("Membre retiré", "")
	}
</script>

<template>
	<div class="teams-view">
		<div class="view-header">
			<div class="view-header-left">
				<div class="view-breadcrumb">
					<span class="breadcrumb-root">RAMI</span>
					<span class="breadcrumb-sep">/</span>
					<span class="breadcrumb-current">ÉQUIPES</span>
				</div>
				<h1 class="view-title">ÉQUIPES</h1>
				<span class="view-sub">GROUPES D'UTILISATEURS — ACCÈS PAR ZONE</span>
			</div>
		</div>

		<div class="teams-split">
			<!-- Liste + création -->
			<aside class="teams-panel">
				<div class="panel-head">ÉQUIPES</div>
				<form
					class="create-row"
					@submit.prevent="create">
					<input
						v-model="newTeamName"
						class="create-input"
						type="text"
						placeholder="NOUVELLE ÉQUIPE…"
						aria-label="Nom de la nouvelle équipe" />
					<button
						class="create-btn"
						type="submit">
						+
					</button>
				</form>
				<ul class="team-list">
					<li
						v-for="t in teams"
						:key="t.id">
						<button
							class="team-row"
							:class="{ active: selected?.id === t.id }"
							@click="selectTeam(t)">
							<span class="team-glyph">▣</span>
							<span class="team-name">{{ t.name }}</span>
							<button
								class="team-del"
								title="Supprimer"
								@click.stop="remove(t)">
								✕
							</button>
						</button>
					</li>
					<li
						v-if="teams.length === 0"
						class="team-empty">
						AUCUNE ÉQUIPE
					</li>
				</ul>
			</aside>

			<!-- Détail équipe -->
			<section class="team-detail">
				<div
					v-if="!selected"
					class="detail-placeholder">
					← SÉLECTIONNE UNE ÉQUIPE
				</div>
				<template v-else>
					<h2 class="detail-title">{{ selected.name }}</h2>

					<p class="block-head">MEMBRES</p>
					<div class="add-member-row">
						<select
							v-model="memberToAdd"
							class="member-select"
							aria-label="Ajouter un membre">
							<option
								value=""
								disabled>
								+ AJOUTER UN MEMBRE…
							</option>
							<option
								v-for="u in addableUsers"
								:key="u.id"
								:value="u.id">
								{{ u.firstName }} {{ u.lastName }}
							</option>
						</select>
						<button
							class="member-btn"
							:disabled="!memberToAdd"
							@click="doAddMember">
							AJOUTER
						</button>
					</div>
					<ul class="member-list">
						<li
							v-for="m in selected.members ?? []"
							:key="m.id"
							class="member-chip">
							<span>{{ m.firstName }} {{ m.lastName }}</span>
							<button
								class="member-x"
								@click="dropMember(m.id)">
								✕
							</button>
						</li>
						<li
							v-if="(selected.members ?? []).length === 0"
							class="member-empty">
							AUCUN MEMBRE
						</li>
					</ul>

					<p class="block-head">ZONES ACCESSIBLES</p>
					<div
						v-if="(selected.zones ?? []).length"
						class="zone-tags">
						<span
							v-for="z in selected.zones"
							:key="z.id"
							class="zone-tag">
							▦ {{ z.name }}
						</span>
					</div>
					<p
						v-else
						class="member-empty">
						AUCUNE ZONE ACCORDÉE — VA DANS « ZONES » POUR EN ACCORDER.
					</p>
				</template>
			</section>
		</div>
	</div>
</template>

<style scoped>
	.teams-view {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 1100px;
		margin: 0 auto;
		width: 100%;
	}
	.view-header {
		padding-bottom: 1rem;
		position: relative;
	}
	.view-header::after {
		content: "";
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(to right, var(--color-primary) 0%, var(--color-border) 40%, transparent 100%);
	}
	.view-breadcrumb {
		display: flex;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
		text-transform: uppercase;
	}
	.breadcrumb-sep {
		opacity: 0.4;
	}
	.breadcrumb-current {
		color: var(--color-primary);
	}
	.view-title {
		font-family: var(--font-display);
		font-size: 2.4rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		line-height: 1;
		color: var(--color-text);
		text-shadow: 0 0 30px var(--color-primary-glow);
	}
	.view-sub {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin-top: 4px;
		display: block;
	}

	.teams-split {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 1.25rem;
		align-items: start;
	}
	.teams-panel,
	.team-detail {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		min-height: 340px;
	}
	.panel-head {
		padding: 0.6rem 0.9rem;
		background: var(--color-surface-secondary);
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
	}
	.create-row {
		display: flex;
		gap: 6px;
		padding: 0.7rem;
		border-bottom: 1px solid var(--color-border);
	}
	.create-input {
		flex: 1;
		min-width: 0;
		background: var(--color-background);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		padding: 0.4rem 0.5rem;
		text-transform: uppercase;
	}
	.create-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}
	.create-btn {
		width: 32px;
		background: var(--color-primary-dim);
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		cursor: pointer;
		font-size: 1rem;
	}
	.team-list {
		list-style: none;
		margin: 0;
		padding: 0.4rem;
	}
	.team-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 0.5rem 0.6rem;
		background: none;
		border: none;
		border-left: 2px solid transparent;
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		color: var(--color-text-muted);
		transition: background var(--dur-fast), color var(--dur-fast);
	}
	.team-row:hover {
		background: var(--color-sidebar-hover);
		color: var(--color-text);
	}
	.team-row.active {
		background: var(--color-primary-dim);
		color: var(--color-primary);
		border-left-color: var(--color-primary);
	}
	.team-glyph {
		color: var(--color-info);
	}
	.team-name {
		flex: 1;
		text-align: left;
	}
	.team-del {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.6rem;
		opacity: 0;
		transition: opacity var(--dur-fast), color var(--dur-fast);
	}
	.team-row:hover .team-del {
		opacity: 1;
	}
	.team-del:hover {
		color: var(--color-danger);
	}
	.team-empty,
	.member-empty {
		padding: 1rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.08em;
	}

	.detail-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 340px;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--color-text-muted);
		letter-spacing: 0.1em;
	}
	.detail-title {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text);
		padding: 1rem 1rem 0;
	}
	.block-head {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
		text-transform: uppercase;
		padding: 1rem 1rem 0.4rem;
	}
	.add-member-row {
		display: flex;
		gap: 8px;
		padding: 0 1rem;
	}
	.member-select {
		flex: 1;
		min-width: 0;
		background: var(--color-background);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		padding: 0.4rem 0.5rem;
		text-transform: uppercase;
	}
	.member-btn {
		padding: 0 0.8rem;
		background: var(--color-primary-dim);
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		cursor: pointer;
	}
	.member-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.member-list {
		list-style: none;
		margin: 0;
		padding: 0.6rem 1rem 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.member-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		font-family: var(--font-mono);
		font-size: 0.64rem;
		color: var(--color-text);
	}
	.member-x {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.55rem;
		padding: 0;
	}
	.member-x:hover {
		color: var(--color-danger);
	}
	.zone-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0.4rem 1rem 1rem;
	}
	.zone-tag {
		padding: 3px 8px;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		border-left: 2px solid var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-text);
	}

	@media (max-width: 760px) {
		.teams-split {
			grid-template-columns: 1fr;
		}
	}
</style>
