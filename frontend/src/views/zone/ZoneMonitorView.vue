<script lang="ts">
	import { computed, defineComponent, onMounted, ref } from "vue"
	import { useAxios } from "@/composables/useAxios.composable"
	import { useZone } from "@/composables/useZone.composable"
	import { useZoneComparison } from "@/composables/useZoneComparison.composable"
	import ComparisonGraph from "@/components/session/ComparisonGraph.vue"

	export default defineComponent({
		name: "ZoneMonitorView",
		components: { ComparisonGraph },
		props: {
			id: { type: String, required: true },
		},
		setup(props) {
			const { axios } = useAxios()
			const { fetchZoneSensors } = useZone()
			const { series, loading, errorMsg, loadZoneSeries, collectMeasureTypes, globalOrigin, buildOverlayChartData, buildSplitChartData } = useZoneComparison()

			const zoneName = ref("")
			const mode = ref<"overlay" | "split">("overlay")
			const selectedMeasureType = ref("")

			const measureTypes = computed(() => collectMeasureTypes(series.value))

			const overlayData = computed(() => {
				if (!selectedMeasureType.value) return { datasets: [] }
				return buildOverlayChartData(series.value, selectedMeasureType.value, globalOrigin(series.value))
			})

			// Capteurs ayant au moins un point (pour le mode divisé).
			const splitPanels = computed(() => series.value.filter(s => s.points.length > 0).map(s => ({ id: s.sensorId, name: s.sensorName, chart: buildSplitChartData(s) })))

			const hasData = computed(() => series.value.some(s => s.points.length > 0))

			onMounted(async () => {
				try {
					const { data } = await axios.get(`zones/${props.id}`)
					zoneName.value = data?.name ?? "ZONE"
				} catch {
					zoneName.value = "ZONE"
				}
				const sensors = await fetchZoneSensors(props.id)
				await loadZoneSeries(sensors ?? [])
				// Type de mesure par défaut = le premier commun trouvé.
				if (measureTypes.value.length) selectedMeasureType.value = measureTypes.value[0]
			})

			return {
				zoneName,
				series,
				loading,
				errorMsg,
				mode,
				selectedMeasureType,
				measureTypes,
				overlayData,
				splitPanels,
				hasData,
			}
		},
	})
</script>

<template>
	<div class="zone-monitor">
		<div class="zm-header">
			<div>
				<h1>{{ zoneName }}</h1>
				<span class="zm-sub">COMPARAISON MULTI-CAPTEURS — {{ series.length }} CAPTEUR(S)</span>
			</div>
			<div class="zm-controls">
				<div
					class="mode-toggle"
					role="group"
					aria-label="Mode d'affichage">
					<button
						:class="{ active: mode === 'overlay' }"
						:aria-pressed="mode === 'overlay'"
						@click="mode = 'overlay'">
						SUPERPOSÉ
					</button>
					<button
						:class="{ active: mode === 'split' }"
						:aria-pressed="mode === 'split'"
						@click="mode = 'split'">
						DIVISÉ
					</button>
				</div>
				<select
					v-if="mode === 'overlay'"
					v-model="selectedMeasureType"
					class="measure-select"
					aria-label="Type de mesure à comparer">
					<option
						v-for="t in measureTypes"
						:key="t"
						:value="t">
						{{ t }}
					</option>
				</select>
			</div>
		</div>

		<div
			v-if="loading"
			class="zm-state">
			CHARGEMENT DES SÉRIES…
		</div>
		<div
			v-else-if="errorMsg"
			class="zm-state zm-error">
			{{ errorMsg }}
		</div>
		<div
			v-else-if="!hasData"
			class="zm-state">
			AUCUNE DONNÉE DISPONIBLE POUR LES CAPTEURS DE CETTE ZONE
		</div>

		<!-- Mode superposé : un graphe, un dataset par capteur -->
		<div
			v-else-if="mode === 'overlay'"
			class="zm-overlay">
			<p class="zm-hint">Comparaison de « {{ selectedMeasureType }} » — chaque courbe = un capteur, aligné sur une origine commune.</p>
			<ComparisonGraph :chart-data="overlayData" />
		</div>

		<!-- Mode divisé : un graphe par capteur -->
		<div
			v-else
			class="zm-split">
			<div
				v-for="panel in splitPanels"
				:key="panel.id"
				class="zm-split-panel">
				<span class="zm-split-title">{{ panel.name }}</span>
				<ComparisonGraph :chart-data="panel.chart" />
			</div>
		</div>
	</div>
</template>

<style scoped>
	.zone-monitor {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.zm-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.zm-header h1 {
		font-family: var(--font-display);
		font-size: 2.2rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text);
		line-height: 1;
	}

	.zm-sub {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.zm-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.mode-toggle {
		display: flex;
		border: 1px solid var(--color-border-bright);
	}

	.mode-toggle button {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		padding: 6px 12px;
		background: transparent;
		color: var(--color-text-muted);
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	.mode-toggle button.active {
		background: var(--color-primary-dim);
		color: var(--color-primary);
	}

	.measure-select {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		padding: 5px 10px;
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text);
		text-transform: uppercase;
	}

	.zm-state {
		padding: 3rem 1rem;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
		border: 1px dashed var(--color-border-bright);
	}

	.zm-error {
		color: var(--color-danger);
		border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
	}

	.zm-hint {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--color-text-muted);
		margin-bottom: 0.5rem;
	}

	.zm-split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
		gap: 1rem;
	}

	.zm-split-title {
		display: block;
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-primary);
		margin-bottom: 0.4rem;
	}

	@media (max-width: 600px) {
		.zm-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
