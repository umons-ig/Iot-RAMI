<template>
	<div class="sessions-panel">
		<div class="panel-header">
			<h2>HISTORIQUE DES SESSIONS</h2>
			<span class="session-count">{{ sessions.length }} ENREG.</span>
		</div>

		<div
			v-if="sessions.length > 0"
			class="panel-body">
			<!-- Liste des sessions -->
			<div class="sessions-list">
				<div
					v-for="session in sessions"
					:key="session.id"
					class="session-row"
					role="button"
					tabindex="0"
					:class="{ 'session-row--selected': selectedSession === session.id }"
					:aria-pressed="selectedSession === session.id"
					@click="handleSessionSelect(session.id)"
					@keydown.enter="handleSessionSelect(session.id)"
					@keydown.space.prevent="handleSessionSelect(session.id)">
					<SessionCard :session="session" />
				</div>
			</div>

			<!-- Graphique -->
			<div class="graph-area">
				<div
					v-if="!selectedSession"
					class="graph-placeholder">
					<span class="placeholder-arrow">←</span>
					<span class="placeholder-text">SÉLECTIONNER UNE SESSION</span>
				</div>
				<template v-else>
					<!-- Stats rapides -->
					<div
						v-if="chartStats.length > 0"
						class="stats-bar">
						<div
							v-for="stat in chartStats"
							:key="stat.label"
							class="stat-chip">
							<span class="stat-label">{{ stat.label }}</span>
							<span class="stat-item"
								>MOY <strong>{{ stat.avg }}</strong></span
							>
							<span class="stat-sep">|</span>
							<span class="stat-item"
								>MIN <strong>{{ stat.min }}</strong></span
							>
							<span class="stat-sep">|</span>
							<span class="stat-item"
								>MAX <strong>{{ stat.max }}</strong></span
							>
						</div>
					</div>
					<Graph :chartData="chartData" />
				</template>
			</div>
		</div>

		<div
			v-else
			class="empty-state">
			AUCUNE SESSION ENREGISTRÉE
		</div>
	</div>
</template>

<script lang="ts">
	import { defineComponent, provide, onMounted, onUnmounted, computed } from "vue"
	import SessionCard from "@/components/session/SessionCard.vue"
	import Graph from "@/components/session/Graph.vue"
	import { useSession } from "@/composables/useSession.composable"

	export default defineComponent({
		components: { SessionCard, Graph },
		setup() {
			const { chartData, sessions, selectedSession, handleSessionSelect, registerOrRemoveEventHandlers } = useSession()

			const chartStats = computed(() => {
				if (!chartData.value?.datasets?.length) return []
				return chartData.value.datasets
					.map((ds: any) => {
						const values = ds.data.map((p: any) => p.y).filter((v: number) => !isNaN(v))
						if (!values.length) return null
						const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length
						const min = Math.min(...values)
						const max = Math.max(...values)
						return {
							label: ds.label,
							avg: avg.toFixed(2),
							min: min.toFixed(2),
							max: max.toFixed(2),
						}
					})
					.filter((stat): stat is { label: string; avg: string; min: string; max: string } => stat !== null)
			})

			provide("title", "HISTORIQUE SESSION")
			provide("chartData", chartData)

			onMounted(() => registerOrRemoveEventHandlers("on"))
			onUnmounted(() => registerOrRemoveEventHandlers("off"))

			return {
				sessions,
				chartData,
				selectedSession,
				handleSessionSelect,
				chartStats,
			}
		},
	})
</script>

<style scoped>
	.sessions-panel {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		width: 100%;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
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

	.panel-body {
		display: flex;
		flex-direction: row;
		gap: 0;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Liste */
	.sessions-list {
		width: 260px;
		min-width: 260px;
		overflow-y: auto;
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.sessions-list > *:not(:last-child) {
		border-bottom: 1px solid var(--color-border);
	}

	.session-row {
		cursor: pointer;
		transition: background-color 0.1s;
		border-left: 2px solid transparent;
	}

	.session-row:hover {
		background: var(--color-primary-dim);
	}

	.session-row--selected {
		background: var(--color-primary-dim);
		border-left-color: var(--color-primary);
	}

	/* Graphique */
	.graph-area {
		flex: 1;
		min-width: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.graph-area :deep(.graph-container) {
		flex: 1;
		min-height: 0;
		border: none;
		border-top: none;
	}

	.graph-area :deep(.chart-wrapper) {
		height: calc(100% - 44px);
	}

	/* Stats rapides */
	.stats-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
		flex-shrink: 0;
	}

	.stat-chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.75rem;
		border-right: 1px solid var(--color-border);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.05em;
	}

	.stat-label {
		color: var(--color-primary);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-right: 0.25rem;
	}

	.stat-item {
		color: var(--color-text-muted);
	}

	.stat-item strong {
		color: var(--color-text);
		font-weight: 600;
	}

	.stat-sep {
		color: var(--color-border-bright);
		opacity: 0.5;
	}

	/* Placeholder graphique */
	.graph-placeholder {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	.placeholder-arrow {
		font-family: var(--font-mono);
		font-size: 2rem;
		animation: nudge 2s ease-in-out infinite;
	}

	.placeholder-text {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	@keyframes nudge {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(-6px);
		}
	}

	@media (max-width: 600px) {
		.panel-body {
			flex-direction: column;
			min-height: 500px;
		}

		.sessions-list {
			width: 100%;
			min-width: unset;
			max-height: 220px;
			border-right: none;
			border-bottom: 1px solid var(--color-border);
		}

		.graph-area {
			height: 320px;
		}

		.graph-placeholder {
			height: 320px;
		}
	}

	/* Empty */
	.empty-state {
		padding: 3rem;
		text-align: center;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
</style>
