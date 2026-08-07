<script lang="ts">
	import { computed, defineComponent, onMounted, onUnmounted, provide, ref } from "vue"
	import { useSession } from "@/composables/useSession.composable"
	import { useChartStats } from "@/composables/useChartStats.composable"
	import { useAxios } from "@/composables/useAxios.composable"
	import { useThreshold } from "@/composables/useThreshold.composable"
	import SensorCard from "@/components/sensor/SensorCard.vue"
	import Graph from "@/components/session/Graph.vue"

	// Au-delà de ce délai sans nouveau point, le signal est considéré perdu.
	const STALE_THRESHOLD_S = 3

	export default defineComponent({
		name: "SensorSessionView",
		components: { SensorCard, Graph },
		props: {
			id: { type: String, required: true },
		},
		setup(props) {
			const { idSensor, chartData, transmissionSpeed, connectionState, lastMessageTime, paused, togglePause, checkAndJoinActiveSession, endSession } = useSession()
			const { axios } = useAxios()
			const { thresholds, fetchThresholdsBySensor } = useThreshold()

			const isSessionActive = ref(false)
			const sensor = ref<any>(null)

			provide("title", "ACQUISITION EN COURS")
			provide("chartData", chartData)

			// Stats par mesure (valeur courante + min/max/moy + unité).
			const stats = useChartStats(chartData)

			// Horloge locale pour faire « monter » le temps écoulé même sans event
			// socket (watchdog) et détecter un signal figé.
			const now = ref(Date.now())
			let clock: ReturnType<typeof setInterval> | undefined

			const secondsSinceLast = computed(() => (lastMessageTime.value ? (now.value - lastMessageTime.value.getTime()) / 1000 : 0))
			const isStale = computed(() => isSessionActive.value && !!lastMessageTime.value && secondsSinceLast.value > STALE_THRESHOLD_S)

			const connectionLabel = computed(() => {
				// L'accès refusé passe AVANT « signal perdu » : sans distinction, un
				// refus d'autorisation se lisait comme une absence d'activité du patient.
				if (connectionState.value === "forbidden") return "ACCÈS REFUSÉ"
				if (isStale.value) return "SIGNAL PERDU"
				if (connectionState.value === "reconnecting") return "RECONNEXION…"
				if (connectionState.value === "connected") return "LIVE"
				return "SESSION EN COURS"
			})
			// Classe d'état pour le style du badge.
			const connectionVariant = computed(() => {
				if (connectionState.value === "forbidden") return "lost"
				if (isStale.value || connectionState.value === "disconnected") return "lost"
				if (connectionState.value === "reconnecting") return "reconnecting"
				return "live"
			})

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

				clock = setInterval(() => {
					now.value = Date.now()
				}, 500)
			})

			onUnmounted(() => {
				if (clock) clearInterval(clock)
				endSession()
			})

			return {
				sensor,
				isSessionActive,
				transmissionSpeed,
				secondsSinceLast,
				stats,
				paused,
				togglePause,
				connectionLabel,
				connectionVariant,
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
						<span class="chip-value">{{ secondsSinceLast.toFixed(1) }}<span class="chip-unit">s</span></span>
					</div>
					<div class="metric-chip">
						<span class="chip-label">FRÉQUENCE</span>
						<span class="chip-value">{{ transmissionSpeed.toFixed(2) }}<span class="chip-unit">Hz</span></span>
					</div>
					<div
						class="badge-live"
						:class="`badge-live--${connectionVariant}`">
						<span class="live-dot" />
						{{ connectionLabel }}
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

		<!-- Valeurs courantes + min/max/moy par mesure -->
		<div
			v-if="isSessionActive && stats.length"
			class="measures-grid">
			<div
				v-for="m in stats"
				:key="m.label"
				class="measure-card">
				<span class="measure-name">{{ m.label }}</span>
				<span class="measure-current">
					{{ m.current !== null ? m.current.toFixed(2) : "—" }}<span class="measure-unit">{{ m.unit }}</span>
				</span>
				<div class="measure-stats">
					<span>min {{ m.min !== null ? m.min.toFixed(1) : "—" }}</span>
					<span>moy {{ m.avg !== null ? m.avg.toFixed(1) : "—" }}</span>
					<span>max {{ m.max !== null ? m.max.toFixed(1) : "—" }}</span>
				</div>
			</div>
		</div>

		<div
			v-if="isSessionActive"
			class="graph-section">
			<div class="graph-toolbar">
				<button
					class="pause-btn"
					:class="{ 'pause-btn--active': paused }"
					:aria-pressed="paused"
					@click="togglePause">
					{{ paused ? "▶ REPRENDRE" : "❚❚ FIGER" }}
				</button>
				<span
					v-if="paused"
					class="frozen-tag"
					>AFFICHAGE FIGÉ</span
				>
			</div>
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

	/* États du badge de connexion (cf. §1.6/A) */
	.badge-live--reconnecting {
		background: color-mix(in srgb, var(--color-warning) 12%, transparent);
		border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
		color: var(--color-warning);
	}
	.badge-live--reconnecting .live-dot {
		background: var(--color-warning);
		box-shadow: 0 0 6px var(--color-warning);
	}
	.badge-live--lost {
		background: var(--color-danger-dim);
		border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
		color: var(--color-danger);
	}
	.badge-live--lost .live-dot {
		background: var(--color-danger);
		box-shadow: 0 0 6px var(--color-danger);
		animation: none;
	}

	/* Grille des valeurs courantes par mesure */
	.measures-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.75rem;
	}

	.measure-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-left: 2px solid var(--color-primary);
		padding: 0.6rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.measure-name {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.measure-current {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 900;
		color: var(--color-primary);
		line-height: 1;
	}

	.measure-unit {
		font-size: 0.8rem;
		opacity: 0.55;
		margin-left: 3px;
	}

	.measure-stats {
		display: flex;
		gap: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
	}

	/* Toolbar du graphe (pause) */
	.graph-toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.pause-btn {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		padding: 5px 12px;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.pause-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.pause-btn--active {
		border-color: var(--color-warning);
		color: var(--color-warning);
		background: color-mix(in srgb, var(--color-warning) 12%, transparent);
	}

	.frozen-tag {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-warning);
	}

	@media (prefers-reduced-motion: reduce) {
		.live-dot,
		.wait-icon {
			animation: none;
		}
	}

	@media (max-width: 600px) {
		.session-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
