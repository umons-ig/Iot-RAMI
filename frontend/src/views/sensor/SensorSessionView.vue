<script lang="ts">
	import { defineComponent, onMounted, onUnmounted, provide, ref } from "vue"
	import { useSession } from "@/composables/useSession.composable"
	import { useAxios } from "@/composables/useAxios.composable"
	import { useThreshold } from "@/composables/useThreshold.composable"
	import SensorCard from "@/components/sensor/SensorCard.vue"
	import Graph from "@/components/session/Graph.vue"

	export default defineComponent({
		name: "SensorSessionView",
		components: { SensorCard, Graph },
		props: {
			id: { type: String, required: true },
		},
		setup(props) {
			const { idSensor, chartData, timeSinceLastValue, transmissionSpeed, checkAndJoinActiveSession, endSession } = useSession()
			const { axios } = useAxios()
			const { thresholds, fetchThresholdsBySensor } = useThreshold()

			const isSessionActive = ref(false)
			const sensor = ref<any>(null)

			provide("title", "ACQUISITION EN COURS")
			provide("chartData", chartData)

			onMounted(async () => {
				try {
					const { data } = await axios.get(`sensors/${props.id}`)
					sensor.value = data
				} catch {
					sensor.value = null
				}
				idSensor.value = props.id
				await fetchThresholdsBySensor(props.id)

				const sensorTopic = (sensor.value?.topic ?? "") + "/sensor"
				const alreadyActive = await checkAndJoinActiveSession(props.id, sensorTopic)
				if (alreadyActive) isSessionActive.value = true
			})

			onUnmounted(async () => {
				endSession()
			})

			return {
				sensor,
				isSessionActive,
				timeSinceLastValue,
				transmissionSpeed,
				thresholds,
			}
		},
	})
</script>

<template>
	<div class="session-view">
		<div
			v-if="sensor"
			class="session-header">
			<div class="header-sensor">
				<SensorCard
					:sensor="sensor"
					:is-for-navigation="false" />
			</div>

			<div class="session-status">
				<div
					v-if="isSessionActive"
					class="metrics-row">
					<div class="metric-chip">
						<span class="chip-label">DERNIÈRE VALEUR</span>
						<span class="chip-value">{{ timeSinceLastValue.toFixed(2) }}<span class="chip-unit">s</span></span>
					</div>
					<div class="metric-chip">
						<span class="chip-label">FRÉQUENCE</span>
						<span class="chip-value">{{ transmissionSpeed.toFixed(2) }}<span class="chip-unit">Hz</span></span>
					</div>
					<div class="badge-live">
						<span class="live-dot" />
						SESSION EN COURS
					</div>
				</div>
				<div
					v-else
					class="badge-inactive">
					<span class="inactive-dot" />
					AUCUNE SESSION ACTIVE
				</div>
			</div>
		</div>

		<div
			v-if="isSessionActive"
			class="graph-section">
			<Graph
				:is-real-time="true"
				:thresholds="thresholds" />
		</div>

		<div
			v-else-if="sensor"
			class="empty-state waiting-state">
			<div class="wait-icon">◌</div>
			<p>EN ATTENTE DE DÉMARRAGE DE SESSION</p>
			<p class="wait-sub">LA SESSION DÉMARRERA AUTOMATIQUEMENT DÈS RÉCEPTION DU PREMIER SIGNAL.</p>
		</div>
	</div>
</template>

<style scoped>
	.session-view {
		max-width: 1000px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.session-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		padding: 1rem 1.25rem;
	}

	.header-sensor {
		flex: 1;
		min-width: 0;
	}

	.header-sensor :deep(.sensor-card) {
		border: none;
		background: transparent;
		box-shadow: none;
		padding-left: 0;
	}

	/* Cache le status-tag intégré dans la card quand elle est dans le header
	   (le statut est déjà affiché par le badge de session à droite) */
	.header-sensor :deep(.status-tag) {
		display: none;
	}

	.session-status {
		flex-shrink: 0;
	}

	.metrics-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.metric-chip {
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border);
		padding: 0.5rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.chip-label {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		color: var(--color-text-muted);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.chip-value {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--color-primary);
		line-height: 1;
	}

	.chip-unit {
		font-size: 0.7rem;
		opacity: 0.5;
		margin-left: 2px;
	}

	.badge-live {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		background: var(--color-success-dim);
		border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
		color: var(--color-success);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-success);
		box-shadow: 0 0 6px var(--color-success);
		flex-shrink: 0;
		animation: blink 1s step-end infinite;
	}

	.badge-inactive {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.inactive-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-text-muted);
		flex-shrink: 0;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.2;
		}
	}

	.graph-section {
		min-height: 450px;
	}

	/* Attente */
	.waiting-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 4rem 2rem;
		border: 1px dashed var(--color-border-bright);
		color: var(--color-text-muted);
	}

	.wait-icon {
		font-size: 2.5rem;
		animation: spin 3s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.waiting-state p {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--color-text-muted);
		text-align: center;
	}

	.wait-sub {
		font-size: 0.72rem !important;
		max-width: 400px;
	}

	@media (max-width: 600px) {
		.session-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
