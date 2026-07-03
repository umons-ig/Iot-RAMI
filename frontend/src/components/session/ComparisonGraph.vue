<template>
	<div class="cmp-graph">
		<div class="cmp-graph__header">
			<span class="cmp-graph__title">COMPARAISON MULTI-SESSIONS</span>
			<span class="cmp-graph__hint">DÉFILEMENT MOLETTE · GLISSER POUR PAN</span>
		</div>
		<div class="cmp-graph__wrapper">
			<Line
				v-if="props.chartData"
				:data="props.chartData"
				:options="chartOptions" />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from "vue"
	import { Chart as ChartJS, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, type ChartOptions, type ChartData } from "chart.js"
	import { Line } from "vue-chartjs"
	import zoomPlugin from "chartjs-plugin-zoom"

	ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend, zoomPlugin)

	// ── Props ──────────────────────────────────────────────────────────

	const props = defineProps<{
		chartData: ChartData<"line", { x: number; y: number }[]>
	}>()

	// ── CSS vars helper ────────────────────────────────────────────────

	const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

	// ── Formateur axe X (ms → "+Xs" / "+Xm Ys") ──────────────────────

	const formatRelativeTime = (ms: number): string => {
		if (ms < 60_000) {
			return `+${Math.floor(ms / 1000)}s`
		}
		const minutes = Math.floor(ms / 60_000)
		const seconds = Math.floor((ms % 60_000) / 1000)
		return `+${minutes}m${seconds}s`
	}

	// ── Options Chart.js ───────────────────────────────────────────────

	const chartOptions = computed<ChartOptions<"line">>(() => ({
		responsive: true,
		maintainAspectRatio: false,
		animation: { duration: 300 },
		interaction: {
			mode: "index",
			intersect: false,
		},
		elements: {
			line: {
				tension: 0.2,
				borderWidth: 1.5,
			},
			point: {
				radius: 0,
				hitRadius: 8,
				hoverRadius: 3,
			},
		},
		scales: {
			x: {
				type: "linear",
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
					maxTicksLimit: 10,
					callback: value => formatRelativeTime(Number(value)),
				},
				title: {
					display: true,
					text: "TEMPS RELATIF DEPUIS LE DÉBUT DE SESSION",
					color: cssVar("--color-text-muted") || "#7a6535",
					font: { family: "Martian Mono", size: 9 },
				},
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
				align: "start",
				labels: {
					color: cssVar("--color-text") || "#f0d89a",
					font: { family: "Martian Mono", size: 10 },
					usePointStyle: true,
					pointStyle: "line",
					boxWidth: 20,
					padding: 14,
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
				callbacks: {
					title: items => formatRelativeTime(Number(items[0]?.parsed?.x ?? 0)),
				},
			},
			zoom: {
				pan: {
					enabled: true,
					mode: "x",
				},
				zoom: {
					wheel: { enabled: true },
					pinch: { enabled: true },
					mode: "x",
				},
			},
		},
	}))
</script>

<style scoped>
	.cmp-graph {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-top: 2px solid var(--color-primary);
		overflow: hidden;
	}

	.cmp-graph__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-secondary);
		flex-shrink: 0;
		gap: 1rem;
	}

	.cmp-graph__title {
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.cmp-graph__hint {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-text-muted);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.5;
	}

	.cmp-graph__wrapper {
		flex: 1;
		min-height: 0;
		padding: 1rem 0.75rem 0.75rem;
		box-sizing: border-box;
		background-image: linear-gradient(var(--color-primary-dim) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary-dim) 1px, transparent 1px);
		background-size: 40px 40px;
	}

	@media (max-width: 768px) {
		.cmp-graph__hint {
			display: none;
		}
	}
</style>
