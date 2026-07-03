<script lang="ts">
	import { defineComponent, ref, onMounted } from "vue"
	import { useAxios } from "@/composables/useAxios.composable"

	export interface LocalDiscoveredSensor {
		baseTopic: string
		firstSeenAt: string
		lastSeenAt: string
		count: number
	}

	export default defineComponent({
		name: "AdminLocalDiscoveredSensors",
		setup() {
			const { axios } = useAxios()
			const discovered = ref<LocalDiscoveredSensor[]>([])
			const names = ref<Record<string, string>>({})
			const registering = ref<Record<string, boolean>>({})
			const registerError = ref("")

			const fetch = async () => {
				try {
					const { data } = await axios.get("sensors/discovered")
					discovered.value = data
				} catch (e) {
					console.error("Erreur fetch discovered:", e)
				}
			}

			const register = async (sensor: LocalDiscoveredSensor) => {
				const name = names.value[sensor.baseTopic]?.trim()
				if (!name) return
				registering.value[sensor.baseTopic] = true
				try {
					await axios.post("sensors", { name, topic: sensor.baseTopic })
					await fetch()
				} catch (e: any) {
					if (e.response?.status === 401 || e.response?.status === 403) {
						registerError.value = "ACCÈS REFUSÉ : droits insuffisants pour enregistrer un capteur."
					} else {
						console.error("Erreur register:", e)
					}
				} finally {
					registering.value[sensor.baseTopic] = false
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

			return { discovered, names, registering, registerError, register, formatDate, fetch }
		},
	})
</script>

<template>
	<div class="discovered">
		<div class="header-row">
			<p class="description">CAPTEURS DÉTECTÉS VIA MQTT — NON ENREGISTRÉS EN BASE</p>
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
			AUCUN NOUVEAU CAPTEUR DÉTECTÉ POUR LE MOMENT
		</div>

		<div class="table-wrapper">
			<table
				v-if="discovered.length > 0"
				class="discovered-table">
				<thead>
					<tr>
						<th>Topic MQTT</th>
						<th>Première détection</th>
						<th>Dernière activité</th>
						<th>Messages</th>
						<th>Nom à donner</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="sensor in discovered"
						:key="sensor.baseTopic">
						<td class="topic-cell">{{ sensor.baseTopic }}</td>
						<td>{{ formatDate(sensor.firstSeenAt) }}</td>
						<td>{{ formatDate(sensor.lastSeenAt) }}</td>
						<td class="count-cell">{{ sensor.count }}</td>
						<td>
							<input
								v-model="names[sensor.baseTopic]"
								class="name-input"
								type="text"
								placeholder="ex: ECG chambre 1" />
						</td>
						<td>
							<button
								class="btn-register"
								:disabled="!names[sensor.baseTopic]?.trim() || registering[sensor.baseTopic]"
								@click="register(sensor)">
								{{ registering[sensor.baseTopic] ? "…" : "ENREGISTRER" }}
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
		min-width: 650px;
	}

	.topic-cell {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-primary);
	}

	.count-cell {
		text-align: center;
	}

	.name-input {
		background: var(--color-surface-secondary);
		color: var(--color-text);
		border: 1px solid var(--color-border-bright);
		border-radius: 0;
		padding: 3px 8px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		width: 100%;
		min-width: 120px;
		outline: none;
		transition: border-color 0.15s;
	}

	.name-input:focus {
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
