<script lang="ts">
	import { defineComponent, onMounted, ref } from "vue"
	import { useRouter } from "vue-router"
	import { useSensor } from "@/composables/useSensor.composable"
	import { useZone } from "@/composables/useZone.composable"
	import { useAxios } from "@/composables/useAxios.composable"
	import { UserFields } from "#/user"
	import type { ZoneTreeNode } from "#/zone"
	import SensorCard from "@/components/sensor/SensorCard.vue"

	function subtreeSensors(node: ZoneTreeNode): number {
		return node.children.reduce((acc, c) => acc + subtreeSensors(c), node.sensorCount)
	}

	export default defineComponent({
		name: "DashboardView",
		components: { SensorCard },
		setup() {
			const { fetchSensors, sensors, totalSensors } = useSensor(undefined)
			const { tree: zoneTree, fetchTree } = useZone()
			const { axios } = useAxios()
			const router = useRouter()

			const totalSessions = ref(0)
			const activeSessions = ref(0)
			const firstName = localStorage.getItem(UserFields.FIRST_NAME) || "vous"
			const userId = localStorage.getItem(UserFields.ID)
			const isLoading = ref(true)

			onMounted(async () => {
				try {
					await Promise.all([fetchSensors(), fetchTree().catch(() => undefined)])
					const [sessionsRes, activeRes] = await Promise.all([axios.get(`users/${userId}/sessions?page=1&limit=1`), axios.get("sessions/active")])
					const payload = sessionsRes.data
					totalSessions.value = payload.total ?? (Array.isArray(payload) ? payload.length : 0)
					activeSessions.value = Array.isArray(activeRes.data) ? activeRes.data.length : 0
				} catch (e) {
					console.error("Erreur lors du chargement des sessions:", e)
				} finally {
					isLoading.value = false
				}
			})

			return {
				sensors,
				totalSensors,
				totalSessions,
				activeSessions,
				zoneTree,
				subtreeSensors,
				firstName,
				isLoading,
				goToSensors: () => router.push({ name: "sensors" }),
				goToZones: () => router.push({ name: "zones" }),
			}
		},
	})
</script>

<template>
	<div class="dashboard">
		<!-- Greeting -->
		<div class="greeting-block">
			<div class="greeting-label"><span class="label-blink">▶</span> TERMINAL RAMI — ACCÈS AUTORISÉ</div>
			<h1 class="greeting-name">{{ firstName.toUpperCase() }}<span class="cursor">_</span></h1>
			<div class="greeting-line" />
		</div>

		<!-- Stats -->
		<div class="stats-row">
			<div
				class="stat-card stat-card--link"
				role="button"
				tabindex="0"
				title="Voir mes capteurs"
				@click="goToSensors"
				@keydown.enter="goToSensors"
				@keydown.space.prevent="goToSensors">
				<span
					v-if="isLoading"
					class="stat-num stat-skeleton"
					>--</span
				>
				<span
					v-else
					class="stat-num"
					>{{ String(totalSensors).padStart(2, "0") }}</span
				>
				<span class="stat-label">CAPTEURS</span>
			</div>
			<div
				class="stat-card stat-card--link"
				role="button"
				tabindex="0"
				title="Voir l'historique des sessions"
				@click="goToSensors"
				@keydown.enter="goToSensors"
				@keydown.space.prevent="goToSensors">
				<span
					v-if="isLoading"
					class="stat-num stat-skeleton"
					>--</span
				>
				<span
					v-else
					class="stat-num"
					>{{ String(totalSessions).padStart(2, "0") }}</span
				>
				<span class="stat-label">SESSIONS TOTAL</span>
			</div>
			<div
				class="stat-card stat-card--live stat-card--link"
				role="button"
				tabindex="0"
				title="Voir les sessions en cours"
				@click="goToSensors"
				@keydown.enter="goToSensors"
				@keydown.space.prevent="goToSensors">
				<span
					v-if="isLoading"
					class="stat-num stat-skeleton"
					>--</span
				>
				<span
					v-else
					class="stat-num"
					>{{ String(activeSessions).padStart(2, "0") }}</span
				>
				<span class="stat-label">EN COURS</span>
			</div>
		</div>

		<!-- Zones — navigation rapide -->
		<section
			v-if="!isLoading && zoneTree.length > 0"
			class="section">
			<div class="section-header">
				<h2>ACCÈS RAPIDE PAR ZONES</h2>
				<span class="section-hint">CLIQUER POUR EXPLORER LE PARC</span>
			</div>
			<div class="zones-grid">
				<button
					v-for="z in zoneTree"
					:key="z.id"
					class="zone-tile"
					@click="goToZones">
					<span class="zone-tile-glyph">▦</span>
					<span class="zone-tile-name">{{ z.name }}</span>
					<span class="zone-tile-meta">{{ subtreeSensors(z) }} capt. · {{ z.children.length }} sous-zones</span>
				</button>
			</div>
		</section>

		<!-- Capteurs — navigation rapide -->
		<section class="section">
			<div class="section-header">
				<h2>ACCÈS RAPIDE AUX CAPTEURS</h2>
				<span class="section-hint">CLIQUER POUR ACCÉDER AU DÉTAIL</span>
			</div>

			<div
				v-if="isLoading"
				class="sensors-loading">
				<div
					v-for="i in 3"
					:key="i"
					class="sensor-skeleton" />
			</div>

			<div
				v-else-if="sensors.length === 0"
				class="empty-state">
				AUCUN CAPTEUR ACCESSIBLE
			</div>

			<div
				v-else
				class="sensors-grid">
				<SensorCard
					v-for="sensor in sensors"
					:key="sensor.id"
					:sensor="sensor"
					:is-for-navigation="true" />
			</div>
		</section>
	</div>
</template>

<style scoped>
	.dashboard {
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* Greeting */
	.greeting-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.greeting-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-primary);
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0.6;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.label-blink {
		animation: label-blink 1.2s step-end infinite;
		font-size: 0.5rem;
	}

	@keyframes label-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	.greeting-name {
		font-family: var(--font-display);
		font-size: clamp(2.5rem, 6vw, 4rem);
		font-weight: 900;
		color: var(--color-text);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		line-height: 1;
		text-shadow: 0 0 40px var(--color-primary-glow);
	}

	.cursor {
		color: var(--color-primary);
		animation: cursor-blink 1s step-end infinite;
		text-shadow: 0 0 12px var(--color-primary);
		margin-left: 2px;
	}

	@keyframes cursor-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	.greeting-line {
		height: 2px;
		background: linear-gradient(to right, var(--color-primary), var(--color-primary-dim), transparent);
		margin-top: 4px;
		position: relative;
		overflow: hidden;
	}

	.greeting-line::after {
		content: "";
		position: absolute;
		top: 0;
		left: -100%;
		width: 60%;
		height: 100%;
		background: linear-gradient(to right, transparent, rgba(255, 159, 10, 0.8), transparent);
		animation: line-scan 3s ease-in-out infinite 0.5s;
	}

	@keyframes line-scan {
		0% {
			left: -60%;
		}
		100% {
			left: 160%;
		}
	}

	/* Stats */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: var(--color-border);
		border: 1px solid var(--color-border);
	}

	.stat-card {
		background: var(--color-surface);
		padding: 2rem 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 4px;
		transition: background-color 0.2s, box-shadow 0.2s;
		position: relative;
		overflow: hidden;
	}

	.stat-card::before {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--color-primary);
		opacity: 0.3;
		transition: opacity 0.2s;
	}

	.stat-card--live::before {
		background: var(--color-success);
		opacity: 0.5;
		animation: live-bar 2s ease-in-out infinite;
	}

	@keyframes live-bar {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
			box-shadow: 0 0 8px var(--color-success);
		}
	}

	.stat-card--link {
		cursor: pointer;
	}

	.stat-card--link:hover {
		background: var(--color-surface-secondary);
		box-shadow: inset 0 0 40px var(--color-primary-dim);
	}

	.stat-card--link:hover::before {
		opacity: 1;
	}

	.stat-skeleton {
		opacity: 0.2;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.5;
		}
	}

	.stat-card--live .stat-num {
		color: var(--color-success);
		text-shadow: 0 0 20px var(--color-success-dim);
	}

	.stat-num {
		font-family: var(--font-display);
		font-size: 4rem;
		font-weight: 900;
		color: var(--color-primary);
		line-height: 1;
		text-shadow: 0 0 20px var(--color-primary-glow);
	}

	.stat-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-text-muted);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	/* Section capteurs */
	.section {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1rem;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border);
		border-bottom: none;
		position: relative;
		overflow: hidden;
	}

	.section-header::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--color-primary);
		opacity: 0.6;
	}

	.section-header h2 {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		color: var(--color-text-muted);
		text-transform: uppercase;
		padding-left: 0.25rem;
	}

	.section-hint {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-primary);
		letter-spacing: 0.1em;
		opacity: 0.5;
	}

	/* Grille capteurs — navigation */
	.sensors-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0;
		border: 1px solid var(--color-border);
	}

	.sensors-grid > * {
		border-bottom: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
	}

	.sensors-grid > *:nth-child(2n) {
		border-right: none;
	}

	/* Grille zones — navigation rapide */
	.zones-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0;
		border: 1px solid var(--color-border);
	}
	.zone-tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 1.1rem 1.2rem;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		border-bottom: 1px solid var(--color-border);
		border-left: 2px solid var(--color-primary);
		cursor: pointer;
		text-align: left;
		transition: background-color var(--dur-base), box-shadow var(--dur-base);
	}
	.zone-tile:hover {
		background: var(--color-surface-secondary);
		box-shadow: inset 0 0 36px var(--color-primary-dim);
	}
	.zone-tile-glyph {
		color: var(--color-primary);
		font-size: 1.1rem;
		text-shadow: 0 0 12px var(--color-primary-glow);
	}
	.zone-tile-name {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text);
		line-height: 1.05;
	}
	.zone-tile-meta {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--color-text-muted);
		letter-spacing: 0.06em;
	}

	/* Skeleton loaders */
	.sensors-loading {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
	}

	.sensor-skeleton {
		height: 64px;
		background: var(--color-surface-secondary);
		border-bottom: 1px solid var(--color-border);
		animation: scan-line 1.2s ease-in-out infinite;
		position: relative;
	}

	.sensor-skeleton::after {
		content: "···";
		position: absolute;
		top: 50%;
		left: 1rem;
		transform: translateY(-50%);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.2em;
		opacity: 0.4;
	}

	.sensor-skeleton:last-child {
		border-bottom: none;
	}

	@keyframes scan-line {
		0% {
			opacity: 0.3;
		}
		50% {
			opacity: 0.7;
		}
		100% {
			opacity: 0.3;
		}
	}

	/* Empty state */
	.empty-state {
		padding: 2.5rem;
		text-align: center;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border: 1px dashed var(--color-border-bright);
	}

	@media (max-width: 600px) {
		.stats-row {
			grid-template-columns: repeat(3, 1fr);
		}

		.stat-card {
			padding: 0.75rem;
		}

		.stat-num {
			font-size: 2rem;
		}

		.section-hint {
			display: none;
		}
	}
</style>
