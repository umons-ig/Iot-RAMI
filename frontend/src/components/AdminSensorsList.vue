<script lang="ts">
	import { defineComponent, ref, onMounted } from "vue"
	import { useAxios } from "@/composables/useAxios.composable"

	export interface Sensor {
		id: number
		name: string
		topic: string
	}

	export default defineComponent({
		name: "AdminSensorsList",
		setup() {
			const { axios } = useAxios()
			const sensors = ref<Sensor[]>([])
			const editing = ref<Record<number, { name: string; topic: string }>>({})
			const saving = ref<Record<number, boolean>>({})
			const deleting = ref<Record<number, boolean>>({})
			const errorMsg = ref("")

			const fetch = async () => {
				try {
					const { data } = await axios.get("sensors")
					sensors.value = data.data ?? data
				} catch (e) {
					console.error("Erreur fetch sensors:", e)
				}
			}

			const startEdit = (sensor: Sensor) => {
				editing.value[sensor.id] = { name: sensor.name, topic: sensor.topic }
			}

			const cancelEdit = (id: number) => {
				delete editing.value[id]
			}

			const save = async (id: number) => {
				const payload = editing.value[id]
				if (!payload?.name.trim() || !payload?.topic.trim()) return
				saving.value[id] = true
				errorMsg.value = ""
				try {
					await axios.put(`sensors/${id}`, { name: payload.name.trim(), topic: payload.topic.trim() })
					await fetch()
					delete editing.value[id]
				} catch (e: any) {
					errorMsg.value = e.response?.data?.message ?? "ERREUR LORS DE LA MISE À JOUR"
				} finally {
					saving.value[id] = false
				}
			}

			const remove = async (sensor: Sensor) => {
				if (!confirm(`SUPPRIMER LE CAPTEUR "${sensor.name}" ? Cette action est irréversible.`)) return
				deleting.value[sensor.id] = true
				errorMsg.value = ""
				try {
					await axios.delete(`sensors/${sensor.id}`)
					sensors.value = sensors.value.filter(s => s.id !== sensor.id)
				} catch (e: any) {
					errorMsg.value = e.response?.data?.message ?? "ERREUR LORS DE LA SUPPRESSION"
				} finally {
					deleting.value[sensor.id] = false
				}
			}

			onMounted(fetch)

			return { sensors, editing, saving, deleting, errorMsg, fetch, startEdit, cancelEdit, save, remove }
		},
	})
</script>

<template>
	<div class="sensors-list">
		<div class="header-row">
			<p class="description">CAPTEURS ENREGISTRÉS EN BASE DE DONNÉES</p>
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
			v-if="sensors.length === 0"
			class="empty-state">
			AUCUN CAPTEUR ENREGISTRÉ
		</div>

		<div class="table-wrapper">
			<table
				v-if="sensors.length > 0"
				class="sensors-table">
				<thead>
					<tr>
						<th>Nom</th>
						<th>Topic MQTT</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="sensor in sensors"
						:key="sensor.id">
						<td>
							<input
								v-if="editing[sensor.id]"
								v-model="editing[sensor.id].name"
								class="edit-input"
								type="text"
								placeholder="Nom du capteur" />
							<span
								v-else
								class="sensor-name"
								>{{ sensor.name }}</span
							>
						</td>
						<td>
							<input
								v-if="editing[sensor.id]"
								v-model="editing[sensor.id].topic"
								class="edit-input"
								type="text"
								placeholder="topic/mqtt" />
							<span
								v-else
								class="topic-cell"
								>{{ sensor.topic }}</span
							>
						</td>
						<td class="actions-cell">
							<template v-if="editing[sensor.id]">
								<button
									:disabled="saving[sensor.id]"
									@click="save(sensor.id)">
									{{ saving[sensor.id] ? "…" : "SAUVER" }}
								</button>
								<button
									class="btn-danger"
									@click="cancelEdit(sensor.id)">
									ANNULER
								</button>
							</template>
							<template v-else>
								<button @click="startEdit(sensor)">RENOMMER</button>
								<button
									class="btn-danger"
									:disabled="deleting[sensor.id]"
									@click="remove(sensor)">
									{{ deleting[sensor.id] ? "…" : "SUPPRIMER" }}
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
	.sensors-list {
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

	.sensors-table {
		width: 100%;
		min-width: 500px;
	}

	.sensor-name {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--color-text);
	}

	.topic-cell {
		font-family: var(--font-mono);
		font-size: 0.72rem;
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
