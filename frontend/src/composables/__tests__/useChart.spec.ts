import { describe, it, expect, vi, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"

vi.mock("chart.js/auto", () => {
	const mockUpdate = vi.fn()
	const mockChart: any = vi.fn().mockImplementation(() => ({ update: mockUpdate }))
	mockChart.getChart = vi.fn()
	mockChart.register = vi.fn()
	return { default: mockChart }
})

vi.mock("chartjs-plugin-zoom", () => ({
	default: {},
}))

vi.mock("@/stores/color", () => ({
	useColorStore: () => ({
		secondary: "#abc",
		secondaryHover: "#def",
		text: "#000",
	}),
}))

vi.mock("@/composables/useDate.composable", () => ({
	useDate: () => ({
		formatDate: (ts: string) => ts,
	}),
}))

import { useChart } from "@/composables/useChart.composable"

describe("useChart", () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	describe("updateChart()", () => {
		it("should create a new Chart when no existing chart found", async () => {
			const Chart = (await import("chart.js/auto")).default as any
			Chart.getChart.mockReturnValue(null)

			const canvas = document.createElement("canvas")
			canvas.id = "test-chart"
			document.body.appendChild(canvas)

			const { updateChart } = useChart()
			updateChart(["2024-01-01"], [42], "ECG", "My Title", "test-chart")

			expect(Chart).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "line" }))

			document.body.removeChild(canvas)
		})

		it("should update existing chart when one is already registered", async () => {
			const mockUpdate = vi.fn()
			const existingChart = {
				data: { labels: [], datasets: [{ data: [], label: "" }] },
				options: { plugins: { title: { text: "" } } },
				update: mockUpdate,
			}
			const Chart = (await import("chart.js/auto")).default as any
			Chart.getChart.mockReturnValue(existingChart)

			const canvas = document.createElement("canvas")
			canvas.id = "existing-chart"
			document.body.appendChild(canvas)

			const { updateChart } = useChart()
			updateChart(["2024-01-01"], [42], "ECG", "New Title", "existing-chart")

			expect(mockUpdate).toHaveBeenCalled()
			expect(existingChart.data.datasets[0].data).toEqual([42])
			expect(existingChart.data.datasets[0].label).toBe("ECG")

			document.body.removeChild(canvas)
		})

		it("should reverse the input arrays before rendering", async () => {
			const mockUpdate = vi.fn()
			const existingChart = {
				data: { labels: [], datasets: [{ data: [], label: "" }] },
				options: { plugins: { title: { text: "" } } },
				update: mockUpdate,
			}
			const Chart = (await import("chart.js/auto")).default as any
			Chart.getChart.mockReturnValue(existingChart)

			const canvas = document.createElement("canvas")
			canvas.id = "reverse-chart"
			document.body.appendChild(canvas)

			const timestamps = ["2024-01-01", "2024-01-02", "2024-01-03"]
			const values = [1, 2, 3]
			const { updateChart } = useChart()
			updateChart(timestamps, values, "ECG", "Title", "reverse-chart")

			expect(existingChart.data.datasets[0].data).toEqual([3, 2, 1])

			document.body.removeChild(canvas)
		})
	})
})
