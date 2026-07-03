<script lang="ts">
	import { defineComponent, ref, onMounted } from "vue"
	import { useAxios } from "@/composables/useAxios.composable"

	export interface MeasurementType {
		id: number
		name: string
	}

	export default defineComponent({
		name: "AdminMeasurementTypesList",
		setup() {
			const { axios } = useAxios()
			const types = ref<MeasurementType[]>([])
			const editing = ref<Record<number, string>>({})
			const saving = ref<Record<number, boolean>>({})
			const deleting = ref<Record<number, boolean>>({})
			const errorMsg = ref("")

			const fetch = async () => {
				try {
					const { data } = await axios.get("measurementTypes")
					types.value = data.data ?? data
				} catch (e) {
					console.error("Erreur fetch measurementTypes:", e)
				}
			}

			const startEdit = (type: MeasurementType) => {
				editing.value[type.id] = type.name
			}

			const cancelEdit = (id: number) => {
				delete editing.value[id]
			}

			const save = async (id: number) => {
				const name = editing.value[id]?.trim()
				if (!name) return
				saving.value[id] = true
				errorMsg.value = ""
				try {
					await axios.put(`measurementTypes/${id}`, { name })
					await fetch()
					delete editing.value[id]
				} catch (e: any) {
					errorMsg.value = e.response?.data?.message ?? "ERREUR LORS DE LA MISE À JOUR"
				} finally {
					saving.value[id] = false
				}
			}

			const remove = async (type: MeasurementType) => {
				if (!confirm(`SUPPRIMER LE TYPE "${type.name}" ? Cette action est irréversible.`)) return
				deleting.value[type.id] = true
				errorMsg.value = ""
				try {
					await axios.delete(`measurementTypes/${type.id}`)
					types.value = types.value.filter(t => t.id !== type.id)
				} catch (e: any) {
					errorMsg.value = e.response?.data?.message ?? "ERREUR LORS DE LA SUPPRESSION"
				} finally {
					deleting.value[type.id] = false
				}
			}

			onMounted(fetch)

			return { types, editing, saving, deleting, errorMsg, fetch, startEdit, cancelEdit, save, remove }
		},
	})
</script>

<template>
	<div class="types-list">
		<div class="header-row">
			<p class="description">TYPES DE MESURES ENREGISTRÉS EN BASE DE DONNÉES</p>
			<button
				class="btn-refresh"
				@click="fetch">
				↺ RAFRAÎCHIR
			</button>
		</div>

		<div
			v-if="errorMsg"
			class="inline-error">
			{{ errorMsg }}
		</div>

		<div
			v-if="types.length === 0"
			class="empty-state">
			AUCUN TYPE DE MESURE ENREGISTRÉ
		</div>

		<div class="table-wrapper">
			<table
				v-if="types.length > 0"
				class="types-table">
				<thead>
					<tr>
						<th>Nom</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="type in types"
						:key="type.id">
						<td>
							<input
								v-if="editing[type.id] !== undefined"
								v-model="editing[type.id]"
								class="edit-input"
								type="text"
								placeholder="Nom du type" />
							<span
								v-else
								class="type-name"
								>{{ type.name }}</span
							>
						</td>
						<td class="actions-cell">
							<template v-if="editing[type.id] !== undefined">
								<button
									:disabled="saving[type.id]"
									@click="save(type.id)">
									{{ saving[type.id] ? "…" : "SAUVER" }}
								</button>
								<button
									class="btn-danger"
									@click="cancelEdit(type.id)">
									ANNULER
								</button>
							</template>
							<template v-else>
								<button @click="startEdit(type)">RENOMMER</button>
								<button
									class="btn-danger"
									:disabled="deleting[type.id]"
									@click="remove(type)">
									{{ deleting[type.id] ? "…" : "SUPPRIMER" }}
								</button>
							</template>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<style scoped>
	.types-list {
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

	.types-table {
		width: 100%;
		min-width: 300px;
	}

	.type-name {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--color-primary);
	}

	.actions-cell {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.edit-input {
		background: var(--color-surface-secondary);
		color: var(--color-text);
		border: 1px solid var(--color-border-bright);
		border-radius: 0;
		padding: 3px 8px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		width: 100%;
		min-width: 100px;
		outline: none;
		transition: border-color 0.15s;
	}

	.edit-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-primary-glow);
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
