<script lang="ts">
	import { defineComponent, ref, onMounted } from "vue"
	import { useAxios } from "@/composables/useAxios.composable"

	export interface DiscoveredMeasurementType {
		measurementType: string
		firstSeenAt: string
		lastSeenAt: string
		count: number
	}

	export default defineComponent({
		name: "AdminDiscoveredMeasurementTypes",
		setup() {
			const { axios } = useAxios()
			const discovered = ref<DiscoveredMeasurementType[]>([])
			const registering = ref<Record<string, boolean>>({})
			const registerError = ref("")

			const fetch = async () => {
				try {
					const { data } = await axios.get("measurementTypes/discovered")
					discovered.value = data
				} catch (e) {
					console.error("Erreur fetch discovered measurement types:", e)
				}
			}

			const register = async (item: DiscoveredMeasurementType) => {
				registering.value[item.measurementType] = true
				try {
					await axios.post("measurementTypes", { name: item.measurementType })
					await fetch()
				} catch (e: any) {
					if (e.response?.status === 401 || e.response?.status === 403) {
						registerError.value = "ACCÈS REFUSÉ : droits insuffisants pour enregistrer un type de mesure."
					} else {
						console.error("Erreur register measurement type:", e)
					}
				} finally {
					registering.value[item.measurementType] = false
				}
			}

			const formatDate = (iso: string) =>
				new Date(iso).toLocaleString("fr-BE", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				})

			onMounted(fetch)

			return { discovered, registering, registerError, register, formatDate, fetch }
		},
	})
</script>

<template>
	<div class="discovered">
		<div class="header-row">
			<p class="description">TYPES DE MESURES DÉTECTÉS — NON ENREGISTRÉS EN BASE</p>
			<button
				class="btn-refresh"
				@click="fetch">
				↺ RAFRAÎCHIR
			</button>
		</div>

		<div
			v-if="registerError"
			class="inline-error">
			{{ registerError }}
		</div>

		<div
			v-if="discovered.length === 0"
			class="empty-state">
			AUCUN NOUVEAU TYPE DE MESURE DÉTECTÉ
		</div>

		<div class="table-wrapper">
			<table
				v-if="discovered.length > 0"
				class="discovered-table">
				<thead>
					<tr>
						<th>Type de mesure</th>
						<th>Première détection</th>
						<th>Dernière activité</th>
						<th>Messages</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="item in discovered"
						:key="item.measurementType">
						<td class="type-cell">{{ item.measurementType }}</td>
						<td>{{ formatDate(item.firstSeenAt) }}</td>
						<td>{{ formatDate(item.lastSeenAt) }}</td>
						<td class="count-cell">{{ item.count }}</td>
						<td>
							<button
								class="btn-register"
								:disabled="registering[item.measurementType]"
								@click="register(item)">
								{{ registering[item.measurementType] ? "…" : "AJOUTER" }}
							</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<style scoped>
	.discovered {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.description {
		flex: 1;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		color: var(--color-text-muted);
		margin: 0;
	}

	.btn-refresh {
		padding: 4px 12px;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		background: var(--color-surface-secondary);
		color: var(--color-text-muted);
		border: 1px solid var(--color-border-bright);
		border-radius: 0;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s;
	}

	.btn-refresh:hover {
		background: var(--color-primary-dim);
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.empty-state {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		color: var(--color-text-muted);
		text-align: center;
		padding: 2rem;
		border: 1px dashed var(--color-border-bright);
	}

	.table-wrapper {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.discovered-table {
		width: 100%;
		min-width: 520px;
	}

	.type-cell {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-primary);
	}

	.count-cell {
		text-align: center;
	}

	.inline-error {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		color: var(--color-danger);
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-danger-dim);
		background: var(--color-danger-dim);
	}
</style>
