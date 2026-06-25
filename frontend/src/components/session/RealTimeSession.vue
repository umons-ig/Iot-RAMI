<template>
	<div class="session-panel">
		<div class="panel-title">
			<h1>NOUVELLE SESSION</h1>
			<span class="panel-sub">ACQUISITION EN TEMPS RÉEL</span>
		</div>

		<!-- Étape 1 : Choix du capteur -->
		<div
			class="step-block"
			:class="{ 'step-block--active': activeStep === 1, 'step-block--done': activeStep > 1 }">
			<div
				class="step-header"
				@click="toggleStep(1)">
				<div class="step-label">
					<span class="step-num">01</span>
					<span class="step-title">SÉLECTION DU CAPTEUR</span>
				</div>
				<span
					class="step-arrow"
					:class="{ 'step-arrow--open': activeStep === 1 }"
					>›</span
				>
			</div>
			<div
				v-if="activeStep === 1"
				class="step-content">
				<SensorsList :isForRealTimeSession="true" />
				<p class="step-hint">Seuls les capteurs EN LIGNE peuvent être sélectionnés.</p>
			</div>
		</div>

		<!-- Étape 2 : En attente -->
		<div
			class="step-block"
			:class="{ 'step-block--active': activeStep === 2, 'step-block--done': activeStep > 2 }">
			<div
				class="step-header"
				@click="toggleStep(2)">
				<div class="step-label">
					<span class="step-num">02</span>
					<span class="step-title">EN ATTENTE DE SESSION</span>
				</div>
				<span
					class="step-arrow"
					:class="{ 'step-arrow--open': activeStep === 2 }"
					>›</span
				>
			</div>
			<div
				v-if="activeStep === 2"
				class="step-content">
				<div class="waiting-message">
					<div class="waiting-icon">◌</div>
					<p>Aucune session active détectée pour ce capteur.</p>
					<p class="waiting-sub">La session démarrera automatiquement dès que le capteur commencera à publier.</p>
				</div>
			</div>
		</div>

		<!-- Étape 3 : Session en cours -->
		<div
			class="step-block"
			:class="{ 'step-block--active': activeStep === 3 }">
			<div
				class="step-header"
				@click="toggleStep(3)">
				<div class="step-label">
					<span class="step-num">03</span>
					<span class="step-title">ACQUISITION</span>
				</div>
				<div class="step-header-right">
					<span
						v-if="activeStep === 3"
						class="badge-live"
						:class="`badge-live--${connectionState}`">
						<span class="live-dot" />
						{{ connectionLabel }}
					</span>
					<span
						class="step-arrow"
						:class="{ 'step-arrow--open': activeStep === 3 }"
						>›</span
					>
				</div>
			</div>
			<div
				v-if="activeStep === 3"
				class="step-content step-content--graph">
				<!-- Graphique -->
				<div class="graph-wrap">
					<Graph :isRealTime="true" />
				</div>

				<!-- Métriques -->
				<div class="metrics-row">
					<div class="metric-box">
						<span class="metric-label">DERNIÈRE VALEUR</span>
						<span class="metric-value">{{ timeSinceLastValue.toFixed(3) }}<span class="metric-unit">s</span></span>
					</div>
					<div class="metric-box">
						<span class="metric-label">FRÉQUENCE</span>
						<span class="metric-value">{{ transmissionSpeed.toFixed(3) }}<span class="metric-unit">Hz</span></span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
	import { ref, computed, provide, defineComponent, onMounted, onUnmounted } from "vue"
	import Graph from "@/components/session/Graph.vue"
	import SensorsList from "@/components/sensor/SensorsList.vue"
	import { EventTypes, handleEvent } from "@/composables/useUser.composable"
	import { useSession } from "@/composables/useSession.composable"
	import { useAxios } from "@/composables/useAxios.composable"

	export default defineComponent({
		name: "CreateSession",
		components: { Graph, SensorsList },
		setup() {
			const { idSensor, chartData, timeSinceLastValue, transmissionSpeed, connectionState, checkAndJoinActiveSession } = useSession()
			const { axios } = useAxios()

			// Libellé du badge temps réel selon l'état de connexion (cf. §1.6).
			const connectionLabel = computed(() => {
				switch (connectionState.value) {
					case "connected":
						return "LIVE"
					case "reconnecting":
						return "RECONNEXION…"
					default:
						return "SIGNAL PERDU"
				}
			})

			const activeStep = ref(1)
			const selectedSensorName = ref("")

			provide("title", "ACQUISITION EN COURS")
			provide("chartData", chartData)

			const sensorSelectedCallback = async (sensorId: string) => {
				idSensor.value = sensorId
				let sensorTopic = "/sensor"
				try {
					const { data } = await axios.get(`sensors/${sensorId}`)
					sensorTopic = (data?.topic ?? "") + "/sensor"
				} catch {
					// fallback: sensorTopic reste "/sensor"
				}
				const alreadyActive = await checkAndJoinActiveSession(sensorId, sensorTopic)
				if (alreadyActive) {
					activeStep.value = 3
				} else {
					nextStep()
				}
			}

			onMounted(() => {
				handleEvent("on", EventTypes.SENSOR_SELECTED_FOR_CREATING_SESSION, sensorSelectedCallback)
			})

			onUnmounted(() => {
				handleEvent("off", EventTypes.SENSOR_SELECTED_FOR_CREATING_SESSION, sensorSelectedCallback)
			})

			const nextStep = () => {
				if (activeStep.value < 3) activeStep.value += 1
			}

			const toggleStep = (step: number) => {
				activeStep.value = activeStep.value === step ? 0 : step
			}

			return {
				activeStep,
				selectedSensorName,
				chartData,
				timeSinceLastValue,
				transmissionSpeed,
				connectionState,
				connectionLabel,
				toggleStep,
			}
		},
	})
</script>

<style scoped>
	.session-panel {
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.panel-title {
		margin-bottom: 1.5rem;
	}

	.panel-title h1 {
		font-family: var(--font-display);
		font-size: 2.4rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		line-height: 1;
		color: var(--color-text);
	}

	.panel-sub {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		display: block;
		margin-top: 4px;
	}

	/* Blocs d'étape */
	.step-block {
		border: 1px solid var(--color-border);
		border-top: none;
		overflow: hidden;
		transition: border-color 0.15s;
	}

	.step-block:first-of-type {
		border-top: 1px solid var(--color-border);
	}

	.step-block--active {
		border-color: var(--color-primary);
		border-left: 2px solid var(--color-primary);
	}

	.step-block--active:first-of-type {
		border-top-color: var(--color-primary);
	}

	.step-block--done {
		border-left: 2px solid color-mix(in srgb, var(--color-success) 40%, transparent);
	}

	.step-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.9rem 1.25rem;
		cursor: pointer;
		background: var(--color-surface-secondary);
		border-bottom: 1px solid transparent;
		transition: background-color 0.15s;
	}

	.step-block--active .step-header {
		border-bottom-color: var(--color-border);
		background: var(--color-primary-dim);
	}

	.step-header:hover {
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.step-label {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.step-num {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--color-primary);
		opacity: 0.4;
		line-height: 1;
	}

	.step-block--active .step-num {
		opacity: 1;
	}

	.step-title {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.step-block--active .step-title {
		color: var(--color-text);
	}

	.step-arrow {
		font-size: 1.3rem;
		color: var(--color-text-muted);
		transition: transform 0.2s;
		line-height: 1;
	}

	.step-arrow--open {
		transform: rotate(90deg);
		color: var(--color-primary);
	}

	.step-header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* Contenu étape */
	.step-content {
		padding: 1.25rem;
		background: var(--color-surface);
	}

	.step-hint {
		margin-top: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-text-muted);
		letter-spacing: 0.04em;
	}

	/* Message attente */
	.waiting-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem;
		text-align: center;
	}

	.waiting-icon {
		font-size: 2rem;
		color: var(--color-text-muted);
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

	.waiting-message p {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--color-text);
	}

	.waiting-sub {
		color: var(--color-text-muted) !important;
		font-size: 0.72rem !important;
		max-width: 420px;
	}

	/* Contenu graphique */
	.step-content--graph {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.graph-wrap {
		height: clamp(350px, 55vh, 600px);
	}

	/* Métriques */
	.metrics-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.metric-box {
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border);
		padding: 0.85rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.metric-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.metric-value {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 900;
		color: var(--color-primary);
		letter-spacing: 0.04em;
		line-height: 1;
		text-shadow: 0 0 20px var(--color-primary-glow);
	}

	.metric-unit {
		font-size: 0.9rem;
		opacity: 0.5;
		margin-left: 3px;
	}

	/* Badge LIVE */
	.badge-live {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--color-danger);
		border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
		padding: 3px 9px;
		background: var(--color-danger-dim);
	}

	/* RECONNEXION… : la liaison temps réel est perdue mais socket.io retente. */
	.badge-live--reconnecting {
		color: var(--color-warning);
		border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
		background: color-mix(in srgb, var(--color-warning) 12%, transparent);
	}
	.badge-live--reconnecting .live-dot {
		background: var(--color-warning);
		box-shadow: 0 0 5px var(--color-warning);
	}

	/* SIGNAL PERDU : déconnexion explicite / pas de reconnexion. */
	.badge-live--disconnected {
		color: var(--color-text-secondary, #888);
		border-color: color-mix(in srgb, currentColor 35%, transparent);
		background: transparent;
	}
	.badge-live--disconnected .live-dot {
		background: currentColor;
		box-shadow: none;
		animation: none;
	}

	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-danger);
		box-shadow: 0 0 5px var(--color-danger);
		animation: blink 1s step-end infinite;
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

	/* Respecte la préférence système de réduction des animations. */
	@media (prefers-reduced-motion: reduce) {
		.live-dot {
			animation: none;
		}
	}

	@media (max-width: 600px) {
		.metrics-row {
			grid-template-columns: 1fr;
		}
	}
</style>
