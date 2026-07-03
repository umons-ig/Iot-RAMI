import Chart from "chart.js/auto"
import zoomPlugin from "chartjs-plugin-zoom"

import { useDate } from "@/composables/useDate.composable"
import { useColorStore } from "@/stores/color"

Chart.register(zoomPlugin)

const useChart = () => {
	const updateChart = (timestampsList: string[], valuesList: number[], label: string, title: string, id: string, scaleSize: number = 14, legendSize: number = 16, titleSize: number = 20) => {
		timestampsList.reverse()
		valuesList.reverse()

		const ctx = document.getElementById(id) as HTMLCanvasElement
		const existingChart = Chart.getChart(ctx)

		const { secondary: backgroundColor, secondaryHover: borderColor, text: textColor } = useColorStore()

		if (existingChart) {
			existingChart.data.labels = timestampsList.map(timestamp => useDate().formatDate(timestamp))
			existingChart.data.datasets[0].data = valuesList
			existingChart.data.datasets[0].label = label
			existingChart.update()
			if (existingChart.options.plugins?.title) {
				existingChart.options.plugins.title.text = title
				existingChart.update()
			}
		} else {
			new Chart(ctx, {
				type: "line",
				data: {
					labels: timestampsList.map(timestamp => useDate().formatDate(timestamp)),
					datasets: [
						{
							label: label,
							data: valuesList,
							backgroundColor: backgroundColor,
							borderColor: borderColor,
							borderWidth: 1,
						},
					],
				},
				options: {
					scales: {
						x: {
							ticks: {
								color: textColor,
								font: {
									size: scaleSize,
								},
							},
							grid: {
								color: textColor,
							},
						},
						y: {
							ticks: {
								color: textColor,
								font: {
									size: scaleSize,
								},
							},
							grid: {
								color: textColor,
							},
							beginAtZero: true,
						},
					},
					plugins: {
						zoom: {
							zoom: {
								wheel: {
									enabled: true,
								},
								pinch: {
									enabled: true,
								},
								mode: "x",
							},
						},
						title: {
							display: true,
							text: title,
							color: textColor,
							font: {
								size: titleSize,
							},
						},
						legend: {
							labels: {
								color: textColor,
								font: {
									size: legendSize,
								},
							},
						},
					},
				},
			})
		}
	}

	return { updateChart }
}

export { useChart }
