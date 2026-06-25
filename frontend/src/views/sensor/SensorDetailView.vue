<script lang="ts">
	import { defineComponent, onMounted, ref } from "vue"
	import { useRouter } from "vue-router"
	import { useSession } from "@/composables/useSession.composable"
	import { useAxios } from "@/composables/useAxios.composable"
	import { useThreshold } from "@/composables/useThreshold.composable"
	import SensorCard from "@/components/sensor/SensorCard.vue"
	import SessionCard from "@/components/session/SessionCard.vue"
	import type { Sensor } from "#/sensor"

	interface MeasurementType {
		id: string
		name: string
	}

	export default defineComponent({
		name: "SensorDetailView",
		components: { SensorCard, SessionCard },
		props: {
			id: { type: String, required: true },
		},
		setup(props) {
			const router = useRouter()
			const { axios } = useAxios()
			const { sessions, fetchAllSessionsOfSensor } = useSession()
			const { thresholds, error: thresholdError, fetchThresholdsBySensor, createThreshold, updateThreshold, deleteThreshold } = useThreshold()
			const sensor = ref<Sensor | null>(null)
			const hasActiveSession = ref(false)
			const measurementTypes = ref<MeasurementType[]>([])

			// Formulaire création/édition seuil
			const thresholdForm = ref<{ idMeasurementType: string; minValue: string; maxValue: string }>({
				idMeasurementType: "",
				minValue: "",
				maxValue: "",
			})
			const thresholdSaving = ref(false)

			onMounted(async () => {
				try {
					const { data } = await axios.get(`sensors/${props.id}`)
					sensor.value = data
				} catch {
					sensor.value = null
				}
				await fetchAllSessionsOfSensor(props.id)
				await fetchThresholdsBySensor(props.id)
				try {
					const { data } = await axios.get("sessions/active")
					hasActiveSession.value = data.some((s: any) => s.idSensor === props.id)
				} catch {
					hasActiveSession.value = false
				}
				try {
					const { data } = await axios.get("measurementTypes")
					measurementTypes.value = data
				} catch {
					// ignore
				}
			})
			const goToSession = () => router.push({ name: "newsession", params: { id: props.id } })

			const getMeasurementTypeName = (id: string) => {
				return measurementTypes.value.find(mt => mt.id === id)?.name ?? id
			}

			const saveThreshold = async () => {
				if (!thresholdForm.value.idMeasurementType) return
				thresholdSaving.value = true

				const existing = thresholds.value.find(t => t.idMeasurementType === thresholdForm.value.idMeasurementType)
				const payload = {
					minValue: thresholdForm.value.minValue !== "" ? parseFloat(thresholdForm.value.minValue) : null,
					maxValue: thresholdForm.value.maxValue !== "" ? parseFloat(thresholdForm.value.maxValue) : null,
				}

				if (existing) {
					await updateThreshold(existing.id, payload)
				} else {
					await createThreshold({ idSensor: props.id, idMeasurementType: thresholdForm.value.idMeasurementType, ...payload })
				}
				thresholdForm.value = { idMeasurementType: "", minValue: "", maxValue: "" }
				thresholdSaving.value = false
			}

			const editThreshold = (t: any) => {
				thresholdForm.value = {
					idMeasurementType: t.idMeasurementType,
					minValue: t.minValue !== null && t.minValue !== undefined ? String(t.minValue) : "",
					maxValue: t.maxValue !== null && t.maxValue !== undefined ? String(t.maxValue) : "",
				}
			}

			const removeThreshold = async (id: string) => {
				await deleteThreshold(id)
				thresholdForm.value = { idMeasurementType: "", minValue: "", maxValue: "" }
			}

			return {
				sensor,
				sessions,
				goToSession,
				hasActiveSession,
				thresholds,
				thresholdError,
				measurementTypes,
				thresholdForm,
				thresholdSaving,
				getMeasurementTypeName,
				saveThreshold,
				editThreshold,
				removeThreshold,
			}
		},
	})
</script>

<template>
	<div class="sensor-detail">
		<div v-if="sensor">
			<!-- En-tête capteur -->
			<div class="detail-header">
				<div class="detail-sensor-info">
					<SensorCard
						:sensor="sensor"
						:is-for-navigation="false" />
				</div>
				<button
					class="btn-session"
					:class="{ 'btn-session--active': hasActiveSession }"
					@click="goToSession">
					<span class="btn-session-icon">{{ hasActiveSession ? "◉" : "+" }}</span>
					{{ hasActiveSession ? "SESSION EN COURS" : "NOUVELLE SESSION" }}
				</button>
			</div>

			<!-- Seuils -->
			<div class="sessions-panel threshold-panel">
				<div class="panel-header">
					<h2>SEUILS D'ALERTE</h2>
					<span class="session-count">{{ thresholds.length }} SEUIL(S)</span>
				</div>

				<!-- Seuils existants -->
				<div
					v-if="thresholds.length > 0"
					class="threshold-list">
					<div
						v-for="t in thresholds"
						:key="t.id"
						class="threshold-row">
						<span class="threshold-type">{{ getMeasurementTypeName(t.idMeasurementType) }}</span>
						<span
							v-if="t.minValue !== null && t.minValue !== undefined"
							class="threshold-badge threshold-badge--min">
							MIN {{ t.minValue }}
						</span>
						<span
							v-if="t.maxValue !== null && t.maxValue !== undefined"
							class="threshold-badge threshold-badge--max">
							MAX {{ t.maxValue }}
						</span>
						<div class="threshold-actions">
							<button
								class="threshold-btn"
								title="Modifier"
								aria-label="Modifier le seuil"
								@click="editThreshold(t)">
								✎
							</button>
							<button
								class="threshold-btn threshold-btn--danger btn-danger"
								title="Supprimer"
								aria-label="Supprimer le seuil"
								@click="removeThreshold(t.id)">
								✕
							</button>
						</div>
					</div>
				</div>

				<!-- Formulaire -->
				<div class="threshold-form">
					<div class="threshold-form-row">
						<select
							v-model="thresholdForm.idMeasurementType"
							class="threshold-input threshold-select">
							<option
								value=""
								disabled>
								TYPE DE MESURE
							</option>
							<option
								v-for="mt in measurementTypes"
								:key="mt.id"
								:value="mt.id">
								{{ mt.name.toUpperCase() }}
							</option>
						</select>
						<input
							v-model="thresholdForm.minValue"
							class="threshold-input"
							type="number"
							placeholder="MIN" />
						<input
							v-model="thresholdForm.maxValue"
							class="threshold-input"
							type="number"
							placeholder="MAX" />
						<button
							class="threshold-save-btn"
							:disabled="!thresholdForm.idMeasurementType || thresholdSaving"
							@click="saveThreshold">
							{{ thresholdSaving ? "..." : "ENREG." }}
						</button>
					</div>
					<p
						v-if="thresholdError"
						class="threshold-error">
						{{ thresholdError }}
					</p>
				</div>
			</div>

			<!-- Sessions -->
			<div class="sessions-panel">
				<div class="panel-header">
					<h2>SESSIONS PASSÉES</h2>
					<span class="session-count">{{ sessions.length }} ENREG.</span>
					<span class="session-hint">→ MES CAPTEURS POUR REJOUER</span>
				</div>

				<div
					v-if="sessions.length === 0"
					class="empty-state">
					AUCUNE SESSION ENREGISTRÉE POUR CE CAPTEUR
				</div>

				<div
					v-else
					class="sessions-list">
					<SessionCard
						v-for="session in sessions"
						:key="session.id"
						:session="session" />
				</div>
			</div>
		</div>

		<div
			v-else
			class="empty-state">
			CAPTEUR INTROUVABLE
			<button
				class="btn-back"
				@click="$router.back()">
				← RETOUR
			</button>
		</div>
	</div>
</template>

<style scoped>
	.sensor-detail {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* En-tête */
	.detail-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: space-between;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		padding: 1rem 1.25rem;
		flex-wrap: wrap;
	}

	.detail-sensor-info {
		flex: 1;
		min-width: 0;
	}

	.detail-sensor-info :deep(.sensor-card) {
		border: none;
		background: transparent;
		box-shadow: none;
		padding-left: 0;
	}

	.detail-sensor-info :deep(.status-tag) {
		display: none;
	}

	.btn-session {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.25rem;
		background: var(--color-success-dim);
		border: 1px solid color-mix(in srgb, var(--color-success) 35%, transparent);
		color: var(--color-success);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.15s;
		border-radius: 0;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.btn-session:hover {
		background: var(--color-success);
		border-color: var(--color-success);
		color: var(--color-text-second);
		box-shadow: 0 0 16px color-mix(in srgb, var(--color-success) 25%, transparent);
	}

	.btn-session--active {
		background: var(--color-primary-dim);
		border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
		color: var(--color-primary);
	}

	.btn-session--active:hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-text-second);
		box-shadow: 0 0 16px var(--color-primary-glow);
	}

	.btn-session-icon {
		font-size: 0.85rem;
	}

	/* Panel sessions */
	.sessions-panel {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
	}

	.panel-header h2 {
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		color: var(--color-text-muted);
	}

	.session-count {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-text-muted);
		letter-spacing: 0.1em;
	}

	.session-hint {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--color-primary);
		letter-spacing: 0.1em;
		opacity: 0.45;
		margin-left: auto;
	}

	.sessions-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.sessions-list > *:not(:last-child) {
		border-bottom: 1px solid var(--color-border);
	}

	.empty-state {
		padding: 3rem;
		text-align: center;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border: 1px dashed var(--color-border-bright);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.btn-back {
		font-family: var(--font-mono);
		color: var(--color-primary);
		background: none;
		border: 1px solid var(--color-border);
		padding: 0.5rem 1rem;
		cursor: pointer;
		letter-spacing: 0.05em;
	}

	.btn-back:hover {
		border-color: var(--color-primary);
	}

	/* ── Seuils ── */
	.threshold-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.threshold-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1.25rem;
		border-bottom: 1px solid var(--color-border);
		flex-wrap: wrap;
	}

	.threshold-type {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--color-text);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		min-width: 90px;
	}

	.threshold-badge {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 700;
		padding: 2px 8px;
		letter-spacing: 0.08em;
	}

	.threshold-badge--min {
		background: var(--color-info-dim);
		border: 1px solid var(--color-info);
		color: var(--color-info);
	}

	.threshold-badge--max {
		background: var(--color-danger-dim);
		border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
		color: var(--color-danger);
	}

	.threshold-actions {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}

	.threshold-btn {
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text-muted);
		padding: 6px 12px;
		min-height: 2.75rem;
		min-width: 2.75rem;
		font-size: 0.7rem;
		cursor: pointer;
		font-family: var(--font-mono);
		border-radius: 0;
		transition: all 0.15s;
	}

	.threshold-btn:hover {
		background: var(--color-primary-dim);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.threshold-btn--danger:hover {
		background: var(--color-danger-dim);
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	.threshold-form {
		padding: 0.75rem 1.25rem;
		background: var(--color-surface-secondary);
		border-top: 1px solid var(--color-border);
	}

	.threshold-form-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.threshold-input {
		background: var(--color-surface);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text);
		padding: 0.4rem 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		border-radius: 0;
		outline: none;
		min-width: 0;
	}

	.threshold-input:focus {
		border-color: var(--color-primary);
	}

	.threshold-select {
		flex: 2;
		min-width: 120px;
		cursor: pointer;
	}

	.threshold-input[type="number"] {
		flex: 1;
		min-width: 70px;
		max-width: 110px;
	}

	.threshold-save-btn {
		background: var(--color-success-dim);
		border: 1px solid color-mix(in srgb, var(--color-success) 35%, transparent);
		color: var(--color-success);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		padding: 0.4rem 0.85rem;
		cursor: pointer;
		border-radius: 0;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.threshold-save-btn:hover:not(:disabled) {
		background: var(--color-success);
		border-color: var(--color-success);
		color: var(--color-text-second);
	}

	.threshold-save-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.threshold-error {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-danger);
		letter-spacing: 0.06em;
		margin-top: 0.4rem;
	}

	@media (max-width: 600px) {
		.session-hint {
			display: none;
		}

		.detail-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.btn-session {
			width: 100%;
			justify-content: center;
		}
	}
</style>
