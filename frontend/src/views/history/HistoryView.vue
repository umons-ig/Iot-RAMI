<template>
	<div class="history">
		<!-- ── En-tête ── -->
		<header class="history__header">
			<div class="history__header-text">
				<h1 class="history__title">HISTORIQUE</h1>
				<span class="history__subtitle">COMPARAISON MULTI-SESSIONS</span>
			</div>
			<p
				v-if="errorMsg"
				class="history__error">
				{{ errorMsg }}
			</p>
		</header>

		<!-- ── Corps split ── -->
		<div class="history__body">
			<!-- Sidebar -->
			<aside class="history__sidebar">
				<!-- Sélecteur capteur -->
				<div class="history__section">
					<label class="history__label">CAPTEUR</label>
					<div class="history__select-wrapper">
						<select
							v-model="selectedSensorId"
							class="history__select"
							@change="onSensorChange">
							<option value="">-- SÉLECTIONNER --</option>
							<option
								v-for="sensor in sensors"
								:key="sensor.id"
								:value="sensor.id">
								{{ sensor.name }}
							</option>
						</select>
						<span class="history__select-arrow">▾</span>
					</div>
				</div>

				<div class="history__divider" />

				<!-- Liste des sessions -->
				<div class="history__section history__section--grow">
					<label class="history__label">
						SESSIONS
						<span
							v-if="sessions.length > 0"
							class="history__count">
							{{ sessions.length }}
						</span>
					</label>

					<div class="history__session-list">
						<!-- Skeleton pendant chargement -->
						<template v-if="loadingSessions">
							<div
								v-for="n in 5"
								:key="n"
								class="history__skeleton" />
						</template>

						<!-- Sessions disponibles -->
						<template v-else-if="sessions.length > 0">
							<label
								v-for="session in sessions"
								:key="session.id"
								class="history__session-item"
								:class="{
									'history__session-item--selected': selectedSessions.includes(session.id),
									'history__session-item--disabled': isSessionDisabled(session.id),
								}">
								<input
									type="checkbox"
									:value="session.id"
									:checked="selectedSessions.includes(session.id)"
									:disabled="isSessionDisabled(session.id)"
									class="history__checkbox"
									@change="toggleSession(session.id)" />
								<div class="history__session-info">
									<span class="history__session-date">
										{{ formatHumanReadableDate(session.createdAt, false, true) }}
									</span>
									<span class="history__session-duration">
										{{ formatDurationDisplay(session) }}
									</span>
								</div>
								<!-- Badge couleur = index dans selectedSessions -->
								<span
									v-if="selectedSessions.includes(session.id)"
									class="history__session-badge"
									:style="{ background: sessionColor(session.id) }">
									S{{ selectedSessions.indexOf(session.id) + 1 }}
								</span>
							</label>
						</template>

						<!-- Aucune session -->
						<p
							v-else-if="selectedSensorId"
							class="history__empty">
							AUCUNE SESSION DISPONIBLE
						</p>
						<p
							v-else
							class="history__empty">
							← CHOISIR UN CAPTEUR
						</p>
					</div>
				</div>

				<!-- Badge compteur sélection -->
				<div
					v-if="selectedSessions.length > 0"
					class="history__selection-bar">
					<span class="history__selection-count">
						<span
							class="history__dot"
							:class="{ 'history__dot--full': selectedSessions.length >= 3 }" />
						{{ selectedSessions.length }}/3 SESSION(S)
					</span>
					<button
						class="history__clear-btn"
						@click="clearSelection">
						EFFACER
					</button>
				</div>
				<div
					v-else
					class="history__max-hint">
					MAX 3 SESSIONS EN SIMULTANÉ
				</div>
			</aside>

			<!-- Zone graphique -->
			<main class="history__graph">
				<!-- Chargement -->
				<div
					v-if="loadingGraph"
					class="history__loading">
					<span class="history__loading-dot" />
					<span class="history__loading-dot history__loading-dot--2" />
					<span class="history__loading-dot history__loading-dot--3" />
					<span class="history__loading-text">CHARGEMENT DES DONNÉES</span>
				</div>

				<!-- Graphique de comparaison -->
				<ComparisonGraph
					v-else-if="selectedSessions.length > 0 && comparisonData"
					:chart-data="comparisonData" />

				<!-- Placeholder -->
				<div
					v-else
					class="history__placeholder">
					<div class="history__placeholder-icon">⊞</div>
					<span class="history__placeholder-main">← SÉLECTIONNER DES SESSIONS</span>
					<small class="history__placeholder-sub">MAX 3 SESSIONS EN SIMULTANÉ</small>
					<small class="history__placeholder-sub">LES COURBES SONT ALIGNÉES SUR T+0</small>
				</div>
			</main>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref, watch, onMounted } from "vue"
	import { useHistoryComparison } from "@/composables/useHistoryComparison.composable"
	import { useSensor } from "@/composables/useSensor.composable"
	import ComparisonGraph from "@/components/session/ComparisonGraph.vue"
	import type { Session } from "#/session"

	// ── Composables ────────────────────────────────────────────────────

	const { sensors, sessions, comparisonData, loadingSessions, loadingGraph, errorMsg, fetchSensors, fetchSessionsForSensor, buildComparisonDatasets } = useHistoryComparison()

	// formatHumanReadableDate et calculateDuration depuis useSensor
	const { formatHumanReadableDate, calculateDuration } = useSensor(undefined)

	// ── State local ────────────────────────────────────────────────────

	const selectedSensorId = ref<string>("")
	const selectedSessions = ref<string[]>([])

	// ── Palette (doit correspondre à useHistoryComparison) ────────────

	const PHOSPHOR_COLORS = ["#ff9f0a", "#39ff14", "#00cfff", "#ff4f80", "#ffcc00", "#bf5af2", "#30d158", "#64d2ff", "#ff6961", "#da8fff"]

	const sessionColor = (sessionId: string): string => {
		const idx = selectedSessions.value.indexOf(sessionId)
		return idx >= 0 ? PHOSPHOR_COLORS[idx % PHOSPHOR_COLORS.length] : "transparent"
	}

	// ── Helpers affichage ──────────────────────────────────────────────

	const formatDurationDisplay = (session: Session): string => {
		if (!session.endedAt) return "EN COURS"
		return calculateDuration(session.createdAt, session.endedAt)
	}

	const isSessionDisabled = (sessionId: string): boolean => {
		return !selectedSessions.value.includes(sessionId) && selectedSessions.value.length >= 3
	}

	// ── Handlers ───────────────────────────────────────────────────────

	const onSensorChange = () => {
		selectedSessions.value = []
		comparisonData.value = null
		if (selectedSensorId.value) {
			fetchSessionsForSensor(selectedSensorId.value)
		}
	}

	const toggleSession = (sessionId: string) => {
		const idx = selectedSessions.value.indexOf(sessionId)
		if (idx >= 0) {
			selectedSessions.value = selectedSessions.value.filter(id => id !== sessionId)
		} else if (selectedSessions.value.length < 3) {
			selectedSessions.value = [...selectedSessions.value, sessionId]
		}
	}

	const clearSelection = () => {
		selectedSessions.value = []
	}

	// ── Watcher — rebuild datasets dès que la sélection change ────────

	watch(
		selectedSessions,
		ids => {
			buildComparisonDatasets(ids)
		},
		{ deep: true }
	)

	// ── Lifecycle ──────────────────────────────────────────────────────

	onMounted(() => {
		fetchSensors()
	})
</script>

<style scoped>
	/* ── Layout racine ── */
	.history {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 100dvh;
		background: var(--color-background);
		color: var(--color-text);
		overflow: hidden;
	}

	/* ── Header ── */
	.history__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem 1.25rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		flex-shrink: 0;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.history__header-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.history__title {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		color: var(--color-primary);
		text-shadow: 0 0 30px var(--color-primary-glow);
		margin: 0;
		line-height: 1;
	}

	.history__subtitle {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-text-muted);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.history__error {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-danger);
		letter-spacing: 0.06em;
		background: var(--color-danger-dim);
		border: 1px solid var(--color-danger);
		padding: 0.4rem 0.75rem;
		margin: 0;
	}

	/* ── Corps split ── */
	.history__body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Sidebar ── */
	.history__sidebar {
		width: 280px;
		min-width: 280px;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.history__section {
		padding: 1rem 1.25rem;
	}

	.history__section--grow {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding-bottom: 0;
	}

	.history__label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--color-text-muted);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 600;
		margin-bottom: 0.6rem;
	}

	.history__count {
		background: var(--color-primary-dim);
		color: var(--color-primary);
		border: 1px solid var(--color-border-bright);
		font-size: 0.6rem;
		padding: 1px 5px;
		letter-spacing: 0.05em;
	}

	/* Select capteur */
	.history__select-wrapper {
		position: relative;
	}

	.history__select {
		width: 100%;
		padding: 0.55rem 2rem 0.55rem 0.75rem;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		appearance: none;
		cursor: pointer;
		transition: border-color 0.15s;
		border-radius: 0;
	}

	.history__select:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.history__select-arrow {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-primary);
		font-size: 0.8rem;
		pointer-events: none;
	}

	.history__divider {
		height: 1px;
		background: var(--color-border);
		margin: 0 1.25rem;
		flex-shrink: 0;
	}

	/* Liste sessions scrollable */
	.history__session-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-right: 2px;
		/* scrollbar fine */
		scrollbar-width: thin;
		scrollbar-color: var(--color-border-bright) transparent;
	}

	.history__session-list::-webkit-scrollbar {
		width: 3px;
	}
	.history__session-list::-webkit-scrollbar-track {
		background: transparent;
	}
	.history__session-list::-webkit-scrollbar-thumb {
		background: var(--color-border-bright);
	}

	/* Item session */
	.history__session-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.5rem;
		border: 1px solid transparent;
		border-left: 2px solid transparent;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
		user-select: none;
	}

	.history__session-item:hover:not(.history__session-item--disabled) {
		background: var(--color-primary-dim);
		border-left-color: var(--color-primary-glow);
	}

	.history__session-item--selected {
		background: var(--color-primary-dim);
		border-color: var(--color-border-bright);
		border-left-color: var(--color-primary);
	}

	.history__session-item--disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.history__checkbox {
		appearance: none;
		width: 12px;
		height: 12px;
		border: 1px solid var(--color-border-bright);
		background: var(--color-surface);
		flex-shrink: 0;
		cursor: pointer;
		position: relative;
		transition: background 0.12s, border-color 0.12s;
	}

	.history__checkbox:checked {
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.history__checkbox:checked::after {
		content: "";
		position: absolute;
		inset: 2px;
		background: var(--color-surface);
		clip-path: polygon(20% 50%, 10% 65%, 45% 95%, 95% 15%, 80% 5%, 42% 72%);
	}

	.history__session-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.history__session-date {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-text);
		letter-spacing: 0.04em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.history__session-duration {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.06em;
	}

	.history__session-badge {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		padding: 1px 5px;
		color: var(--color-background);
		flex-shrink: 0;
	}

	/* Skeletons */
	.history__skeleton {
		height: 46px;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border);
		animation: scan-line 1.2s ease-in-out infinite;
		position: relative;
	}

	.history__skeleton::after {
		content: "···";
		position: absolute;
		top: 50%;
		left: 0.75rem;
		transform: translateY(-50%);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.2em;
		opacity: 0.35;
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

	.history__empty {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--color-text-muted);
		letter-spacing: 0.1em;
		text-align: center;
		padding: 1.5rem 0;
		margin: 0;
	}

	/* Barre de sélection en bas de sidebar */
	.history__selection-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
		flex-shrink: 0;
	}

	.history__selection-count {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--color-primary);
		letter-spacing: 0.1em;
		font-weight: 600;
	}

	.history__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-primary);
		animation: pulse-dot 2s ease-in-out infinite;
	}

	.history__dot--full {
		background: var(--color-danger);
		animation: none;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
			box-shadow: 0 0 6px var(--color-primary);
		}
		50% {
			opacity: 0.5;
			box-shadow: 0 0 2px var(--color-primary);
		}
	}

	.history__clear-btn {
		background: none;
		border: 1px solid var(--color-border-bright);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		padding: 3px 8px;
		cursor: pointer;
		transition: all 0.15s;
		border-radius: 0;
	}

	.history__clear-btn:hover {
		border-color: var(--color-danger);
		color: var(--color-danger);
		background: var(--color-danger-dim);
	}

	.history__max-hint {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--color-text-muted);
		letter-spacing: 0.1em;
		text-align: center;
		padding: 0.65rem 1.25rem;
		border-top: 1px solid var(--color-border);
		opacity: 0.5;
		flex-shrink: 0;
	}

	/* ── Zone graphique ── */
	.history__graph {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: stretch;
		overflow: hidden;
		background: var(--color-background);
	}

	.history__graph > * {
		width: 100%;
	}

	/* Loading */
	.history__loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		width: 100%;
		height: 100%;
	}

	.history__loading-text {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-text-muted);
		letter-spacing: 0.14em;
	}

	.history__loading-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-primary);
		animation: bounce-dot 1.2s ease-in-out infinite;
	}

	.history__loading-dot--2 {
		animation-delay: 0.2s;
	}
	.history__loading-dot--3 {
		animation-delay: 0.4s;
	}

	@keyframes bounce-dot {
		0%,
		80%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		40% {
			transform: translateY(-4px);
			opacity: 1;
		}
	}

	/* Placeholder */
	.history__placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		width: 100%;
		height: 100%;
		color: var(--color-text-muted);
	}

	.history__placeholder-icon {
		font-size: 2.5rem;
		opacity: 0.15;
		line-height: 1;
	}

	.history__placeholder-main {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		animation: fade-blink 3s ease-in-out infinite;
	}

	.history__placeholder-sub {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		opacity: 0.5;
		text-transform: uppercase;
	}

	@keyframes fade-blink {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 0.9;
		}
	}

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.history {
			min-height: 100dvh;
		}

		.history__header {
			padding: 1rem 1.25rem;
		}

		.history__title {
			font-size: 1.5rem;
		}

		.history__body {
			flex-direction: column;
			overflow: auto;
		}

		.history__sidebar {
			width: 100%;
			min-width: 0;
			border-right: none;
			border-bottom: 1px solid var(--color-border);
			max-height: 260px;
		}

		.history__section--grow {
			min-height: 0;
		}

		.history__graph {
			min-height: 350px;
			flex-shrink: 0;
		}
	}
</style>
