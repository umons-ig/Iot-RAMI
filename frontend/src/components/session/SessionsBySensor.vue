<template>
	<div class="sessions-by-sensor">
		<h3>Répartition des sessions par capteur (durée moyenne : {{ averageDuration }} min)</h3>
		<BarChart :chartData="chartDataSessionDistribution" />
	</div>
</template>

<script lang="ts">
	import { defineComponent, onMounted } from "vue"
	import BarChart from "@/components/BarChart.vue"
	import { useDistributionSessionBySensor } from "@/composables/useSession.composable"

	export default defineComponent({
		name: "SessionsBySensor",
		components: {
			BarChart,
		},
		setup() {
			const { chartDataSessionDistribution, averageDuration, fetchSessionsBySensor } = useDistributionSessionBySensor()

			onMounted(() => {
				fetchSessionsBySensor()
			})

			return {
				chartDataSessionDistribution,
				averageDuration,
			}
		},
	})
</script>

<style scoped>
	.sessions-by-sensor {
		padding: 20px;
		background-color: var(--color-surface);
		border-radius: 10px;
		text-align: center;
		color: var(--color-text);
	}
</style>
