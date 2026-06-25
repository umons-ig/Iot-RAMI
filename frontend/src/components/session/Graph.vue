<template>
	<div class="graph-container">
		<div class="graph-header">
			<span class="graph-title">{{ title }}</span>
			<div
				v-if="!props.isRealTime"
				class="chart-controls">
				<button
					class="ctrl-btn"
					title="Rewind"
					aria-label="Reculer"
					@click="rewind">
					◁◁
				</button>
				<button
					class="ctrl-btn"
					title="Play"
					aria-label="Lecture"
					@click="play">
					▷
				</button>
				<button
					class="ctrl-btn"
					title="Pause"
					aria-label="Pause"
					@click="pause">
					▐▐
				</button>
				<button
					class="ctrl-btn"
					title="Fast forward"
					aria-label="Avancer"
					@click="fastForward">
					▷▷
				</button>
			</div>
			<div
				v-else
				class="live-indicator">
				<span class="live-dot" />
				LIVE
			</div>
		</div>
		<div class="chart-wrapper">
			<LineChart
				ref="chartRef"
				:data="chartData"
				:options="chartOptions" />
		</div>
	</div>
</template>

<script lang="ts">
	import { defineComponent, inject, onMounted, onUnmounted, nextTick, ref, watch } from "vue"
	import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, type ChartOptions, type ChartData } from "chart.js"
	import { Line as LineChart } from "vue-chartjs"
	import zoomPlugin from "chartjs-plugin-zoom"
	import "chartjs-adapter-date-fns"
	import { EventTypes, handleEvent } from "@/composables/useUser.composable"
	import { useTheme } from "@/composables/useTheme.composable"
	import type { Threshold } from "@/composables/useThreshold.composable"

	// NB : la décimation Chart.js (LTTB) nécessite `parsing:false`, incompatible
	// avec les datasets de seuils (tableaux plats indexés sur labels). Reportée
	// (cf. PLAN_AMELIORATIONS §2.2) — l'historique s'appuie déjà sur le
	// sous-échantillonnage backend (maxPoints).
	ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, zoomPlugin)

	// Palette ambre phosphore pour les datasets multiples
	const PHOSPHOR_COLORS = [
		{ line: "#ff9f0a", fill: "rgba(255,159,10,0.08)" }, // Ambre
		{ line: "#39ff14", fill: "rgba(57,255,20,0.06)" }, // Vert
		{ line: "#00cfff", fill: "rgba(0,207,255,0.06)" }, // Cyan
		{ line: "#ff4f80", fill: "rgba(255,79,128,0.06)" }, // Rose
		{ line: "#ffcc00", fill: "rgba(255,204,0,0.06)" }, // Jaune
	]

	export default defineComponent({
		name: "SessionGraph",
		components: { LineChart },
		props: {
			isRealTime: {
				type: Boolean,
				default: false,
			},
			thresholds: {
				type: Array as () => Threshold[],
				default: () => [],
			},
		},
		setup(props) {
			// Lit une variable CSS depuis :root
			const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

			const title = inject<string>("title")
			const injectedChartData = inject<ChartData<"line">>("chartData")
			const chartData = ref<ChartData<"line">>(
				injectedChartData || {
					labels: [],
					datasets: [{ label: "Dataset", data: [] }],
				}
			)
			const chartRef = ref<InstanceType<typeof LineChart> | null>(null)
			let animationInterval: ReturnType<typeof setInterval> | null = null

			const chartOptions: ChartOptions<"line"> = {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration: props.isRealTime ? 0 : 300 },
				interaction: {
					mode: "index",
					intersect: false,
				},
				elements: {
					line: {
						// Courbes droites en temps réel : les splines Bézier coûtent
						// cher à chaque frame. Lissage conservé pour l'historique. §2.2
						tension: props.isRealTime ? 0 : 0.2,
						borderWidth: 2,
					},
					point: {
						radius: 0,
						hitRadius: 10,
						hoverRadius: 4,
					},
				},
				scales: {
					x: {
						type: "time",
						time: { unit: "second" },
						grid: {
							color: cssVar("--color-primary-dim") || "rgba(255,159,10,0.07)",
							lineWidth: 1,
						},
						border: {
							color: cssVar("--color-border-bright") || "rgba(255,159,10,0.2)",
						},
						ticks: {
							color: cssVar("--color-text-muted") || "#7a6535",
							font: { family: "Martian Mono", size: 10 },
							maxTicksLimit: 8,
						},
						title: { display: false },
					},
					y: {
						grid: {
							color: cssVar("--color-primary-dim") || "rgba(255,159,10,0.07)",
							lineWidth: 1,
						},
						border: {
							color: cssVar("--color-border-bright") || "rgba(255,159,10,0.2)",
						},
						ticks: {
							color: cssVar("--color-text-muted") || "#7a6535",
							font: { family: "Martian Mono", size: 10 },
						},
						title: { display: false },
					},
				},
				plugins: {
					legend: {
						position: "top",
						align: "end",
						labels: {
							color: cssVar("--color-text-muted") || "#7a6535",
							font: { family: "Martian Mono", size: 10 },
							usePointStyle: true,
							pointStyle: "line",
							boxWidth: 18,
							padding: 16,
						},
					},
					tooltip: {
						backgroundColor: cssVar("--color-surface") || "#0f0c00",
						borderColor: cssVar("--color-border") || "#241c00",
						borderWidth: 1,
						titleColor: cssVar("--color-primary") || "#ff9f0a",
						bodyColor: cssVar("--color-text") || "#f0d89a",
						titleFont: { family: "Martian Mono", size: 11 },
						bodyFont: { family: "Martian Mono", size: 11 },
						padding: 10,
						cornerRadius: 0,
					},
					zoom: {
						pan: {
							enabled: !props.isRealTime,
							mode: "x",
						},
						zoom: {
							wheel: { enabled: !props.isRealTime },
							pinch: { enabled: !props.isRealTime },
							mode: "x",
						},
					},
				},
			}

			// Applique les couleurs phosphore aux datasets (ignore les datasets seuil)
			const applyDatasetColors = () => {
				if (chartData.value?.datasets) {
					let colorIdx = 0
					chartData.value.datasets.forEach((ds: any) => {
						if (ds._isThreshold) return
						const palette = PHOSPHOR_COLORS[colorIdx % PHOSPHOR_COLORS.length]
						if (!ds.borderColor) ds.borderColor = palette.line
						if (!ds.backgroundColor) ds.backgroundColor = palette.fill
						colorIdx++
					})
				}
			}

			// Reconstruit les datasets seuil depuis la prop thresholds
			const rebuildThresholdDatasets = () => {
				if (!chartData.value) return
				const labels = chartData.value.labels as string[] | undefined
				if (!labels || labels.length === 0) return

				chartData.value.datasets = chartData.value.datasets.filter((ds: any) => !ds._isThreshold)

				for (const t of props.thresholds) {
					if (t.maxValue !== null && t.maxValue !== undefined) {
						chartData.value.datasets.push({
							label: `MAX`,
							data: labels.map(() => t.maxValue as number),
							borderColor: "rgba(255,64,64,0.75)",
							backgroundColor: "transparent",
							borderDash: [6, 3],
							borderWidth: 1.5,
							pointRadius: 0,
							fill: false,
							tension: 0,
							_isThreshold: true,
						} as any)
					}
					if (t.minValue !== null && t.minValue !== undefined) {
						chartData.value.datasets.push({
							label: `MIN`,
							data: labels.map(() => t.minValue as number),
							borderColor: "rgba(0,207,255,0.75)",
							backgroundColor: "transparent",
							borderDash: [6, 3],
							borderWidth: 1.5,
							pointRadius: 0,
							fill: false,
							tension: 0,
							_isThreshold: true,
						} as any)
					}
				}
			}

			const updateScale = (direction: "forward" | "backward", stepFactor: number) => {
				if (chartRef.value) {
					const chart = chartRef.value.chart as ChartJS
					const scales = chart.options.scales
					if (scales && scales.x) {
						const xScale = scales.x
						if (typeof xScale.min === "number" && typeof xScale.max === "number") {
							const step = (xScale.max - xScale.min) / stepFactor
							if (direction === "forward") {
								xScale.min += step
								xScale.max += step
							} else {
								xScale.min -= step
								xScale.max -= step
							}
							chart.update("none")
						}
					}
				}
			}

			const clearAnimationInterval = () => {
				if (animationInterval) {
					clearInterval(animationInterval)
					animationInterval = null
				}
			}

			const play = () => {
				if (animationInterval) return
				animationInterval = setInterval(() => updateScale("forward", 100), 100)
			}
			const pause = () => clearAnimationInterval()
			const fastForward = () => {
				clearAnimationInterval()
				updateScale("forward", 10)
			}
			const rewind = () => {
				clearAnimationInterval()
				updateScale("backward", 10)
			}

			const chooseNewXScale = (date1: string, date2: string) => {
				if (chartRef.value) {
					const chart = chartRef.value.chart as ChartJS
					const scales = chart.options.scales
					if (scales && scales.x) {
						scales.x.min = date1
						scales.x.max = date2
						chart.update("resize")
					}
				}
			}

			const handleSessionSelected = (session: { id: string; startDate: string; endDate: string }) => {
				chooseNewXScale(session.startDate, session.endDate)
			}

			// Couleurs (grille, axes, légende, tooltip) relues depuis les variables
			// CSS et réappliquées au changement de thème — avant, elles étaient
			// figées à la création du graphe et ne suivaient pas dark/light/CRT. §2.3
			const applyThemeColors = () => {
				const grid = cssVar("--color-primary-dim") || "rgba(255,159,10,0.07)"
				const borderColor = cssVar("--color-border-bright") || "rgba(255,159,10,0.2)"
				const muted = cssVar("--color-text-muted") || "#7a6535"
				const scales = chartOptions.scales as any
				if (scales?.x) {
					scales.x.grid.color = grid
					scales.x.border.color = borderColor
					scales.x.ticks.color = muted
				}
				if (scales?.y) {
					scales.y.grid.color = grid
					scales.y.border.color = borderColor
					scales.y.ticks.color = muted
				}
				const plugins = chartOptions.plugins as any
				if (plugins?.legend) plugins.legend.labels.color = muted
				if (plugins?.tooltip) {
					plugins.tooltip.backgroundColor = cssVar("--color-surface") || "#0f0c00"
					plugins.tooltip.borderColor = cssVar("--color-border") || "#241c00"
					plugins.tooltip.titleColor = cssVar("--color-primary") || "#ff9f0a"
					plugins.tooltip.bodyColor = cssVar("--color-text") || "#f0d89a"
				}
				;(chartRef.value?.chart as ChartJS | undefined)?.update("none")
			}

			const { theme } = useTheme()
			watch(theme, () => nextTick().then(applyThemeColors))

			onMounted(() => {
				applyDatasetColors()
				rebuildThresholdDatasets()
				if (!props.isRealTime) {
					handleEvent("on", EventTypes.SESSION_SELECTED, handleSessionSelected)
				}
			})

			watch(
				() => props.thresholds,
				() => rebuildThresholdDatasets(),
				{ deep: true }
			)

			onUnmounted(() => {
				clearAnimationInterval()
				if (!props.isRealTime) {
					handleEvent("off", EventTypes.SESSION_SELECTED, handleSessionSelected)
				}
			})

			return {
				title,
				chartData,
				chartOptions,
				chartRef,
				play,
				pause,
				fastForward,
				rewind,
				chooseNewXScale,
				rebuildThresholdDatasets,
				props,
			}
		},
	})
</script>

<style scoped>
	.graph-container {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-top: 2px solid var(--color-primary);
		width: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.graph-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
		gap: 1rem;
		flex-shrink: 0;
	}

	.graph-title {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	/* Contrôles */
	.chart-controls {
		display: flex;
		gap: 4px;
	}

	.ctrl-btn {
		background: var(--color-surface-secondary);
		border: 1px solid var(--color-border-bright);
		color: var(--color-text-muted);
		padding: 4px 10px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
		border-radius: 0;
		font-family: var(--font-mono);
		letter-spacing: 0;
		text-transform: none;
	}

	.ctrl-btn:hover {
		background: var(--color-primary-dim);
		border-color: var(--color-primary);
		color: var(--color-primary);
		box-shadow: 0 0 8px var(--color-primary-glow);
		text-shadow: 0 0 8px var(--color-primary);
	}

	/* Indicateur LIVE */
	.live-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--color-danger);
		text-transform: uppercase;
	}

	.live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-danger);
		box-shadow: 0 0 6px var(--color-danger);
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

	/* Zone graphique */
	.chart-wrapper {
		height: 400px;
		width: 100%;
		padding: 1rem 0.5rem 0.75rem;
		box-sizing: border-box;
		/* Légère grille de fond pour l'effet oscilloscope */
		background-image: linear-gradient(var(--color-primary-dim) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary-dim) 1px, transparent 1px);
		background-size: 40px 40px;
	}
</style>
