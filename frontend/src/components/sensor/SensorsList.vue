<template>
	<div
		class="sensors-list-view"
		:class="{ 'sensors-list-view--standalone': standalone }">
		<!-- En-tête du panel -->
		<div class="list-header">
			<div class="list-header-left">
				<h2>INVENTAIRE CAPTEURS</h2>
				<span class="sensor-count">
					<span class="count-total">{{ standalone ? totalSensors : sensors.length }}</span>
					<span class="count-unit">UNIT{{ (standalone ? totalSensors : sensors.length) > 1 ? "S" : "" }}</span>
				</span>
			</div>
			<div class="list-header-right">
				<span class="header-tag">TEMPS RÉEL</span>
			</div>
		</div>

		<!-- Recherche (mode standalone) -->
		<div
			v-if="standalone"
			class="search-bar">
			<span class="search-icon">⌕</span>
			<input
				v-model="search"
				class="search-input"
				type="text"
				placeholder="RECHERCHER UN CAPTEUR…"
				aria-label="Rechercher un capteur"
				autocomplete="off"
				@input="onSearch" />
			<button
				v-if="search"
				class="search-clear"
				aria-label="Effacer la recherche"
				@click="clearSearch">
				✕
			</button>
		</div>

		<!-- Corps de la liste -->
		<div
			class="sensors-list"
			:class="{ 'sensors-list--empty': sensors.length === 0 }">
			<div
				v-if="sensors.length > 0"
				class="sensors-list-inner">
				<div
					v-for="(sensor, index) in sensors"
					:key="sensor.id"
					class="sensor-row">
					<span class="sensor-index">{{ String(pageOffset + index + 1).padStart(2, "0") }}</span>
					<SensorCard
						:sensor="sensor"
						:isForRealTimeSession="props.isForRealTimeSession"
						:selectedSensorId="selectedSensor"
						:isForNavigation="standalone"
						:externalStatus="sensorStatuses[sensor.name]"
						@click="handleSensorSelect(sensor.id)" />
				</div>
			</div>
			<div
				v-else
				class="empty-state">
				<span class="empty-icon">◌</span>
				<span class="empty-text">AUCUN CAPTEUR ASSIGNÉ</span>
				<span class="empty-hint">Contactez un administrateur pour obtenir l'accès aux capteurs.</span>
			</div>
		</div>

		<!-- Pagination (mode standalone uniquement) -->
		<div
			v-if="standalone && totalPages > 1"
			class="pagination-bar">
			<button
				class="page-btn"
				:disabled="currentPage <= 1"
				@click="goToPage(currentPage - 1)">
				← PREV
			</button>

			<div class="page-numbers">
				<button
					v-for="p in pageNumbers"
					:key="p"
					class="page-btn page-btn--num"
					:class="{ 'page-btn--active': p === currentPage, 'page-btn--ellipsis': p === '…' }"
					:disabled="p === '…' || p === currentPage"
					@click="typeof p === 'number' && goToPage(p)">
					{{ p }}
				</button>
			</div>

			<button
				class="page-btn"
				:disabled="currentPage >= totalPages"
				@click="goToPage(currentPage + 1)">
				NEXT →
			</button>

			<span class="page-info"> {{ currentPage }} / {{ totalPages }} </span>
		</div>
	</div>
</template>

<script lang="ts">
	import { defineComponent, onMounted, onUnmounted, computed, reactive, ref } from "vue"
	import SensorCard from "@/components/sensor/SensorCard.vue"
	import { useSensor, SensorState } from "@/composables/useSensor.composable"
	import { useSocket } from "@/composables/useSocket.composable"

	const PAGE_LIMIT = 20

	export default defineComponent({
		name: "SensorsListView",
		components: { SensorCard },
		props: {
			isForRealTimeSession: {
				type: Boolean,
				default: false,
			},
			standalone: {
				type: Boolean,
				default: false,
			},
		},
		setup(props) {
			const { sensors, selectedSensor, fetchSensors, getAllSensorsStatus, handleSensorSelect, currentPage, totalPages, totalSensors } = useSensor(undefined)
			const { createSocket } = useSocket()

			const sensorStatuses = reactive<Record<string, SensorState>>({})

			// 1 seule connexion Socket.io pour toute la liste
			const socket = createSocket()
			socket.on("sensor-status", (data: { sensorName: string; status: SensorState }) => {
				sensorStatuses[data.sensorName] = data.status
			})

			const loadStatuses = async () => {
				try {
					const statuses = await getAllSensorsStatus()
					Object.assign(sensorStatuses, statuses)
				} catch {
					// statut reste UNKNOWN si l'appel échoue
				}
			}

			// ── Recherche de capteurs (serveur, via ?name=) ──
			const search = ref("")
			let searchTimer: ReturnType<typeof setTimeout> | undefined
			const onSearch = () => {
				if (searchTimer) clearTimeout(searchTimer)
				searchTimer = setTimeout(async () => {
					await fetchSensors(1, PAGE_LIMIT, search.value)
					await loadStatuses()
				}, 300)
			}
			const clearSearch = async () => {
				search.value = ""
				await fetchSensors(1, PAGE_LIMIT)
				await loadStatuses()
			}

			onMounted(async () => {
				await fetchSensors(1, PAGE_LIMIT)
				await loadStatuses()
			})

			onUnmounted(() => {
				socket.disconnect()
			})

			const goToPage = async (page: number) => {
				if (page < 1 || page > totalPages.value) return
				await fetchSensors(page, PAGE_LIMIT, search.value)
				await loadStatuses()
				// Scroll vers le haut de la liste
				const el = document.querySelector(".sensors-list-view--standalone")
				if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
			}

			// Index d'affichage global (ex: page 2 limit 20 → commence à 20)
			const pageOffset = computed(() => (currentPage.value - 1) * PAGE_LIMIT)

			// Génère la séquence de numéros de page avec ellipsis si besoin
			const pageNumbers = computed<(number | "…")[]>(() => {
				const total = totalPages.value
				const cur = currentPage.value
				if (total <= 7) {
					return Array.from({ length: total }, (_, i) => i + 1)
				}
				const pages: (number | "…")[] = [1]
				if (cur > 3) pages.push("…")
				const start = Math.max(2, cur - 1)
				const end = Math.min(total - 1, cur + 1)
				for (let i = start; i <= end; i++) pages.push(i)
				if (cur < total - 2) pages.push("…")
				pages.push(total)
				return pages
			})

			return {
				sensors,
				selectedSensor,
				handleSensorSelect,
				currentPage,
				totalPages,
				totalSensors,
				pageOffset,
				pageNumbers,
				goToPage,
				sensorStatuses,
				search,
				onSearch,
				clearSearch,
				props,
			}
		},
	})
</script>

<style scoped>
	.sensors-list-view {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
	}

	/* ── En-tête ── */
	.list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
		gap: 0.75rem;
	}

	.list-header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.list-header h2 {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 900;
		letter-spacing: 0.18em;
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	.sensor-count {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.count-total {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--color-primary);
		line-height: 1;
	}

	.count-unit {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		color: var(--color-primary);
		letter-spacing: 0.12em;
		opacity: 0.6;
	}

	.list-header-right {
		flex-shrink: 0;
	}

	.header-tag {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
		text-transform: uppercase;
		padding: 2px 6px;
		border: 1px solid var(--color-border-bright);
		opacity: 0.6;
	}

	/* ── Recherche ── */
	.search-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 1rem 0.75rem;
		padding: 0.45rem 0.7rem;
		background: var(--color-background);
		border: 1px solid var(--color-border-bright);
		transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
	}
	.search-bar:focus-within {
		border-color: var(--color-primary);
		box-shadow: inset 0 0 14px var(--color-primary-dim);
	}
	.search-icon {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		flex-shrink: 0;
	}
	.search-input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		caret-color: var(--color-primary);
	}
	.search-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.7;
	}
	.search-clear {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.65rem;
		padding: 0;
		flex-shrink: 0;
		transition: color var(--dur-fast);
	}
	.search-clear:hover {
		color: var(--color-danger);
	}

	/* ── Liste ── */
	.sensors-list {
		display: flex;
		flex-direction: column;
	}

	/* Mode panel interne (ex: RealTimeSession) — hauteur contrainte */
	.sensors-list-view:not(.sensors-list-view--standalone) .sensors-list {
		max-height: min(50vh, 480px);
		overflow-y: auto;
	}

	.sensors-list--empty {
		padding: 2.5rem 1rem;
	}

	.sensors-list-inner {
		display: flex;
		flex-direction: column;
	}

	/* Ligne capteur avec index */
	.sensor-row {
		display: flex;
		align-items: stretch;
		border-bottom: 1px solid var(--color-border);
	}

	.sensor-row:last-child {
		border-bottom: none;
	}

	.sensor-index {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-border-bright);
		letter-spacing: 0.08em;
		padding: 0 0.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 36px;
		border-right: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
		flex-shrink: 0;
		user-select: none;
		transition: color 0.15s;
	}

	/* Le SensorCard prend tout le reste de la largeur */
	.sensor-row :deep(.sensor-card) {
		flex: 1;
		border: none;
		border-radius: 0;
	}

	/* Hover de la ligne : l'index s'illumine */
	.sensor-row:hover .sensor-index {
		color: var(--color-primary);
	}

	/* ── État vide ── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
	}

	.empty-icon {
		font-size: 1.8rem;
		color: var(--color-border-bright);
		line-height: 1;
	}

	.empty-text {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.empty-hint {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		opacity: 0.5;
		max-width: 280px;
		line-height: 1.5;
	}

	/* ── Pagination ── */
	.pagination-bar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
		flex-wrap: wrap;
	}

	.page-btn {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		background: transparent;
		border: 1px solid var(--color-border);
		padding: 3px 8px;
		cursor: pointer;
		transition: color 0.12s, border-color 0.12s, background 0.12s;
		line-height: 1.6;
		white-space: nowrap;
	}

	.page-btn:hover:not(:disabled) {
		color: var(--color-text);
		border-color: var(--color-border-bright);
		background: var(--color-primary-dim);
	}

	.page-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.page-btn--active {
		color: var(--color-text-second);
		background: var(--color-primary);
		border-color: var(--color-primary);
		cursor: default;
	}

	.page-btn--active:hover {
		background: var(--color-primary);
		color: var(--color-text-second);
	}

	.page-btn--ellipsis {
		border-color: transparent;
		padding: 3px 4px;
	}

	.page-numbers {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.page-info {
		font-family: var(--font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		color: var(--color-text-muted);
		margin-left: auto;
		opacity: 0.6;
	}
</style>
