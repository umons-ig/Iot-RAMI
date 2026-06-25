<script lang="ts" setup>
	import { ref, computed, onMounted } from "vue"
	import type { ZoneTreeNode } from "#/zone"
	import type { Sensor } from "#/sensor"
	import ZoneTree from "@/components/zone/ZoneTree.vue"
	import { useZone } from "@/composables/useZone.composable"
	import { useAxios } from "@/composables/useAxios.composable"
	import { useToast } from "@/composables/useToast.composable"

	const { tree, zoneSensors, loading, fetchTree, fetchZoneSensors, createZone, updateZone, deleteZone, assignSensor } = useZone()
	const { axios } = useAxios()
	const toast = useToast()

	const selected = ref<ZoneTreeNode | null>(null)
	const allSensors = ref<Sensor[]>([])
	const sensorFilter = ref("")
	const sensorToAssign = ref("")

	// ── Modale créer / éditer ────────────────────────────────
	const modal = ref<{ mode: "create" | "edit"; parentId: string | null; id?: string } | null>(null)
	const form = ref<{ name: string; type: string }>({ name: "", type: "" })

	const isAdmin = localStorage.getItem("role") === "admin"

	async function loadAllSensors() {
		// Récupère tous les capteurs en suivant la pagination.
		const collected: Sensor[] = []
		let page = 1
		let totalPages = 1
		do {
			const { data } = await axios.get("/sensors", { params: { page, limit: 100 } })
			collected.push(...(data.data ?? []))
			totalPages = data.totalPages ?? 1
			page++
		} while (page <= totalPages)
		allSensors.value = collected
	}

	onMounted(async () => {
		await Promise.all([fetchTree(), loadAllSensors()])
	})

	async function selectZone(node: ZoneTreeNode) {
		selected.value = node
		sensorFilter.value = ""
		sensorToAssign.value = ""
		await fetchZoneSensors(node.id)
	}

	const filteredSensors = computed(() => {
		const q = sensorFilter.value.trim().toLowerCase()
		if (!q) return zoneSensors.value
		return zoneSensors.value.filter(s => s.name.toLowerCase().includes(q))
	})

	// Capteurs non rattachés à la zone sélectionnée (candidats à l'affectation).
	const assignableSensors = computed(() => {
		const currentId = selected.value?.id
		return allSensors.value.filter(s => s.zoneId !== currentId)
	})

	// ── Actions modale ───────────────────────────────────────
	function openCreate(parentId: string | null) {
		modal.value = { mode: "create", parentId }
		form.value = { name: "", type: parentId ? "" : "company" }
	}
	function openEdit(node: ZoneTreeNode) {
		modal.value = { mode: "edit", parentId: node.parentId, id: node.id }
		form.value = { name: node.name, type: node.type ?? "" }
	}
	function closeModal() {
		modal.value = null
	}

	async function submitModal() {
		if (!form.value.name.trim()) {
			toast.warning("Nom requis", "Donne un nom à la zone.")
			return
		}
		try {
			if (modal.value?.mode === "create") {
				await createZone({
					name: form.value.name,
					type: form.value.type || null,
					parentId: modal.value.parentId,
				})
				toast.success("Zone créée", form.value.name)
			} else if (modal.value?.mode === "edit" && modal.value.id) {
				await updateZone(modal.value.id, {
					name: form.value.name,
					type: form.value.type || null,
				})
				toast.success("Zone mise à jour", form.value.name)
			}
			closeModal()
			await fetchTree()
		} catch {
			toast.danger("Échec", "L'opération a échoué.")
		}
	}

	async function removeZone(node: ZoneTreeNode) {
		const hasContent = node.children.length > 0 || node.sensorCount > 0
		const msg = hasContent ? `« ${node.name} » contient des sous-zones et/ou des capteurs. Supprimer en cascade ?` : `Supprimer la zone « ${node.name} » ?`
		if (!window.confirm(msg)) return
		try {
			await deleteZone(node.id, hasContent)
			toast.success("Zone supprimée", node.name)
			if (selected.value?.id === node.id) selected.value = null
			await fetchTree()
		} catch {
			toast.danger("Échec", "Suppression impossible.")
		}
	}

	async function doAssign() {
		if (!sensorToAssign.value || !selected.value) return
		try {
			await assignSensor(sensorToAssign.value, selected.value.id)
			toast.success("Capteur rattaché", "")
			sensorToAssign.value = ""
			await Promise.all([fetchZoneSensors(selected.value.id), loadAllSensors(), fetchTree()])
		} catch {
			toast.danger("Échec", "Affectation impossible.")
		}
	}

	async function detach(sensor: Sensor) {
		try {
			await assignSensor(sensor.id, null)
			toast.info("Capteur détaché", sensor.name)
			if (selected.value) {
				await Promise.all([fetchZoneSensors(selected.value.id), loadAllSensors(), fetchTree()])
			}
		} catch {
			toast.danger("Échec", "Détachement impossible.")
		}
	}
</script>

<template>
	<div class="zones-view">
		<div class="view-header">
			<div class="view-header-left">
				<div class="view-breadcrumb">
					<span class="breadcrumb-root">RAMI</span>
					<span class="breadcrumb-sep">/</span>
					<span class="breadcrumb-current">ZONES</span>
				</div>
				<h1 class="view-title">CARTOGRAPHIE DU PARC</h1>
				<span class="view-sub">ENTREPRISE › BÂTIMENT › ÉTAGE › PIÈCE</span>
			</div>
			<button
				v-if="isAdmin"
				class="btn-root"
				@click="openCreate(null)">
				+ ZONE RACINE
			</button>
		</div>

		<div class="zones-split">
			<!-- Arbre -->
			<aside class="zones-tree-panel">
				<div class="panel-head">ARBORESCENCE</div>
				<div
					v-if="loading"
					class="panel-empty">
					CHARGEMENT…
				</div>
				<div
					v-else-if="tree.length === 0"
					class="panel-empty">
					AUCUNE ZONE.<br />CRÉE UNE ZONE RACINE →
				</div>
				<ZoneTree
					v-else
					:nodes="tree"
					:selected-id="selected?.id ?? null"
					@select="selectZone"
					@add-child="openCreate($event.id)"
					@edit="openEdit"
					@delete="removeZone" />
			</aside>

			<!-- Détail de la zone -->
			<section class="zones-detail-panel">
				<div
					v-if="!selected"
					class="detail-placeholder">
					← SÉLECTIONNE UNE ZONE
				</div>

				<template v-else>
					<div class="detail-head">
						<div>
							<h2 class="detail-title">{{ selected.name }}</h2>
							<span
								v-if="selected.type"
								class="detail-type">
								{{ selected.type }}
							</span>
						</div>
						<span class="detail-count">{{ zoneSensors.length }} CAPTEUR(S)</span>
					</div>

					<!-- Affectation -->
					<div
						v-if="isAdmin"
						class="assign-row">
						<select
							v-model="sensorToAssign"
							class="assign-select"
							aria-label="Capteur à rattacher">
							<option
								value=""
								disabled>
								RATTACHER UN CAPTEUR…
							</option>
							<option
								v-for="s in assignableSensors"
								:key="s.id"
								:value="s.id">
								{{ s.name }}{{ s.zoneId ? " (déplacer)" : "" }}
							</option>
						</select>
						<button
							class="btn-assign"
							:disabled="!sensorToAssign"
							@click="doAssign">
							RATTACHER
						</button>
					</div>

					<!-- Filtre + liste -->
					<input
						v-model="sensorFilter"
						class="sensor-filter"
						type="text"
						placeholder="FILTRER PAR NOM / TYPE…"
						aria-label="Filtrer les capteurs" />

					<div
						v-if="filteredSensors.length === 0"
						class="panel-empty">
						AUCUN CAPTEUR DANS CETTE ZONE.
					</div>
					<ul
						v-else
						class="sensor-grid">
						<li
							v-for="s in filteredSensors"
							:key="s.id"
							class="sensor-chip">
							<span class="chip-dot" />
							<span class="chip-name">{{ s.name }}</span>
							<button
								v-if="isAdmin"
								class="chip-detach"
								title="Détacher de la zone"
								@click="detach(s)">
								✕
							</button>
						</li>
					</ul>
				</template>
			</section>
		</div>

		<!-- Modale créer / éditer -->
		<Transition name="zmodal">
			<div
				v-if="modal"
				class="zmodal-backdrop"
				@click.self="closeModal">
				<div class="zmodal">
					<p class="zmodal__title">
						{{ modal.mode === "create" ? "NOUVELLE ZONE" : "RENOMMER LA ZONE" }}
					</p>
					<label class="zfield">
						<span>NOM</span>
						<input
							v-model="form.name"
							type="text"
							autofocus
							@keydown.enter="submitModal" />
					</label>
					<label class="zfield">
						<span>TYPE (libre)</span>
						<input
							v-model="form.type"
							type="text"
							placeholder="company / building / floor / room…"
							@keydown.enter="submitModal" />
					</label>
					<div class="zmodal__actions">
						<button
							class="btn-ghost"
							@click="closeModal">
							ANNULER
						</button>
						<button
							class="btn-primary"
							@click="submitModal">
							{{ modal.mode === "create" ? "CRÉER" : "ENREGISTRER" }}
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<style scoped>
	.zones-view {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
	}

	/* En-tête (repris du design system des autres vues) */
	.view-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1rem;
		flex-wrap: wrap;
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
	.view-header-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
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
	}

	.btn-root {
		align-self: flex-end;
		padding: 0.5rem 0.9rem;
		background: var(--color-primary-dim);
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: box-shadow var(--dur-fast);
	}
	.btn-root:hover {
		box-shadow: 0 0 14px var(--color-primary-glow);
	}

	/* Split */
	.zones-split {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.zones-tree-panel,
	.zones-detail-panel {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		min-height: 360px;
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

	.zones-tree-panel :deep(.ztree) {
		padding: 0.5rem;
	}

	.panel-empty,
	.detail-placeholder {
		padding: 2rem 1rem;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		color: var(--color-text-muted);
		line-height: 1.8;
	}
	.detail-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 360px;
		animation: pulse-soft 2.5s ease-in-out infinite;
	}
	@keyframes pulse-soft {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.85;
		}
	}

	/* Détail */
	.detail-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}
	.detail-title {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text);
	}
	.detail-type {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border-bright);
		padding: 1px 5px;
	}
	.detail-count {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-primary);
		letter-spacing: 0.08em;
	}

	.assign-row {
		display: flex;
		gap: 8px;
		padding: 0.9rem 1rem 0;
	}
	.assign-select,
	.sensor-filter {
		width: 100%;
		background: var(--color-background);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		padding: 0.45rem 0.6rem;
		letter-spacing: 0.05em;
	}
	.assign-select:focus,
	.sensor-filter:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: inset 0 0 12px var(--color-primary-dim);
	}
	.sensor-filter {
		margin: 0.9rem 1rem 0;
		width: calc(100% - 2rem);
		text-transform: uppercase;
	}
	.btn-assign {
		flex-shrink: 0;
		padding: 0 0.9rem;
		background: var(--color-primary-dim);
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.btn-assign:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.sensor-grid {
		list-style: none;
		margin: 0;
		padding: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.sensor-chip {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 5px 10px;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-text);
	}
	.chip-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-success);
		box-shadow: 0 0 5px var(--color-success);
	}
	.chip-detach {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.6rem;
		padding: 0;
	}
	.chip-detach:hover {
		color: var(--color-danger);
	}

	/* Modale */
	.zmodal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-overlay);
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(3px);
	}
	.zmodal {
		width: min(420px, calc(100vw - 2rem));
		background: var(--color-surface);
		border: 1px solid var(--color-primary);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), 0 0 36px var(--color-primary-dim);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.zmodal__title {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		color: var(--color-primary);
	}
	.zfield {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.zfield span {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
	}
	.zfield input {
		background: var(--color-background);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		padding: 0.5rem 0.6rem;
	}
	.zfield input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: inset 0 0 12px var(--color-primary-dim);
	}
	.zmodal__actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 0.5rem;
	}
	.btn-ghost,
	.btn-primary {
		padding: 0.5rem 1rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		cursor: pointer;
		border: 1px solid var(--color-border-bright);
		background: none;
		color: var(--color-text-muted);
	}
	.btn-ghost:hover {
		color: var(--color-text);
	}
	.btn-primary {
		border-color: var(--color-primary);
		background: var(--color-primary-dim);
		color: var(--color-primary);
	}
	.btn-primary:hover {
		box-shadow: 0 0 14px var(--color-primary-glow);
	}

	.zmodal-enter-active,
	.zmodal-leave-active {
		transition: opacity var(--dur-base);
	}
	.zmodal-enter-from,
	.zmodal-leave-to {
		opacity: 0;
	}

	@media (max-width: 760px) {
		.zones-split {
			grid-template-columns: 1fr;
		}
	}
</style>
