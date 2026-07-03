<template>
	<div>
		<canvas ref="canvas"></canvas>
	</div>
</template>

<script lang="ts">
	import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from "vue"
	import { Chart, registerables, type ChartData } from "chart.js"
	import { useSensor } from "@/composables/useSensor.composable"

	Chart.register(...registerables)

	export default defineComponent({
		name: "BarChart",
		props: {
			chartData: {
				type: Object as () => ChartData<"bar">,
				required: true,
			},
		},
		setup(props) {
			const { throwUserRequestSessionBySensor } = useSensor(undefined)

			const canvas = ref<HTMLCanvasElement | null>(null)
			let chartInstance: Chart | null = null

			onMounted(() => {
				if (canvas.value) {
					chartInstance = new Chart(canvas.value, {
						type: "bar",
						data: props.chartData,
						options: {
							responsive: true,
							maintainAspectRatio: false,
							onClick: (event, elements) => {
								if (elements.length > 0) {
									const elementIndex = elements[0].index
									const label = props.chartData.labels ? props.chartData.labels[elementIndex] : null
									if (label) {
										throwUserRequestSessionBySensor(label as string)
									}
								}
							},
						},
					})
				}
			})

			// Watch for changes in chartData prop and update the chart
			watch(
				() => props.chartData,
				newData => {
					if (chartInstance) {
						chartInstance.data = newData
						chartInstance.update()
					}
				},
				{ deep: true } // This ensures nested properties are also watched
			)

			onBeforeUnmount(() => {
				if (chartInstance) {
					chartInstance.destroy()
				}
			})

			return {
				canvas,
			}
		},
	})
</script>

<style scoped>
	canvas {
		width: 100%;
		height: 400px;
	}
</style>
