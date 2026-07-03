import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { setActivePinia, createPinia } from "pinia"

const mockGet = vi.fn()
vi.mock("@/composables/useAxios.composable", () => ({
	useAxios: () => ({ axios: { get: mockGet } }),
}))

vi.mock("@/composables/useUser.composable", () => ({
	useUser: vi.fn(),
	UserFields: { TOKEN: "token", ID: "id" },
	EventTypes: {
		SENSOR_SELECTED_FOR_FETCHING_SESSIONS: "sensor.fetch.session",
		USER_SELECTED_FOR_FETCHING_SESSIONS: "user.fetch.session",
		USER_REQUEST_SESSION_BY_SENSOR: "user.session.on.a.sensor",
		SESSION_SELECTED: "session.selected",
	},
	handleEvent: vi.fn(),
}))

const mockEmit = vi.fn()
const mockOn = vi.fn()
const mockOff = vi.fn()
const mockDisconnect = vi.fn()
vi.mock("socket.io-client", () => ({
	io: vi.fn(() => ({ emit: mockEmit, on: mockOn, off: mockOff, disconnect: mockDisconnect })),
}))

import { useSession } from "@/composables/useSession.composable"

const getItemMock = vi.fn().mockReturnValue("fake-token")

describe("useSession", () => {
	beforeAll(() => {
		Object.defineProperty(window, "localStorage", {
			value: { getItem: getItemMock, setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
			writable: true,
			configurable: true,
		})
	})

	beforeEach(() => {
		setActivePinia(createPinia())
		mockGet.mockReset()
		mockEmit.mockReset()
		mockOn.mockReset()
		mockOff.mockReset()
		mockDisconnect.mockReset()
		getItemMock.mockReturnValue("fake-token")
	})

	describe("initial state", () => {
		it("should start with empty topic", () => {
			const { topic } = useSession()
			expect(topic.value).toBe("")
		})

		it("should start with empty idSensor", () => {
			const { idSensor } = useSession()
			expect(idSensor.value).toBe("")
		})

		it("should start with empty datasets", () => {
			const { chartData } = useSession()
			expect(chartData.value.datasets).toEqual([])
		})

		it("should start with null selectedSession", () => {
			const { selectedSession } = useSession()
			expect(selectedSession.value).toBeNull()
		})

		it("should start with empty sessions list", () => {
			const { sessions } = useSession()
			expect(sessions.value).toEqual([])
		})
	})

	describe("startSessionOnClientSide()", () => {
		it("should set topic and idSensor", () => {
			const { topic, idSensor, startSessionOnClientSide } = useSession()
			startSessionOnClientSide("my-topic", "sensor1")
			expect(topic.value).toBe("my-topic")
			expect(idSensor.value).toBe("sensor1")
		})

		it("should connect to WebSocket and emit join-session", () => {
			const { startSessionOnClientSide } = useSession()
			startSessionOnClientSide("my-topic", "sensor1")
			expect(mockEmit).toHaveBeenCalledWith("join-session", expect.objectContaining({ topic: "my-topic" }))
		})

		it("should register new-data listener on socket", () => {
			const { startSessionOnClientSide } = useSession()
			startSessionOnClientSide("my-topic", "sensor1")
			expect(mockOn).toHaveBeenCalledWith("new-data", expect.any(Function))
		})
	})

	describe("connectionState (reconnexion §1.6)", () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const findHandler = (event: string) => mockOn.mock.calls.find((c: any[]) => c[0] === event)?.[1]

		it("passe à 'connected' et réémet join-session à la (re)connexion", () => {
			const { startSessionOnClientSide, connectionState } = useSession()
			startSessionOnClientSide("my-topic", "sensor1")
			// Pas encore connecté tant que l'event 'connect' n'a pas été reçu.
			expect(connectionState.value).toBe("disconnected")

			mockEmit.mockClear()
			const connectHandler = findHandler("connect")
			expect(connectHandler).toBeTypeOf("function")
			connectHandler()

			expect(connectionState.value).toBe("connected")
			expect(mockEmit).toHaveBeenCalledWith("join-session", expect.objectContaining({ topic: "my-topic" }))
		})

		it("passe à 'reconnecting' à la déconnexion", () => {
			const { startSessionOnClientSide, connectionState } = useSession()
			startSessionOnClientSide("my-topic", "sensor1")
			const disconnectHandler = findHandler("disconnect")
			expect(disconnectHandler).toBeTypeOf("function")
			disconnectHandler()
			expect(connectionState.value).toBe("reconnecting")
		})
	})

	describe("endSession()", () => {
		it("should reset topic", () => {
			const { topic, startSessionOnClientSide, endSession } = useSession()
			startSessionOnClientSide("my-topic", "sensor1")
			endSession()
			expect(topic.value).toBe("")
		})

		it("should reset idSession", () => {
			const { idSession, endSession } = useSession()
			endSession()
			expect(idSession.value).toBe("")
		})

		it("should disconnect socket", () => {
			const { startSessionOnClientSide, endSession } = useSession()
			startSessionOnClientSide("my-topic", "sensor1")
			endSession()
			expect(mockDisconnect).toHaveBeenCalled()
		})
	})

	describe("fetchDataAndUpdateChart()", () => {
		it("should populate chartData with one dataset per measureType", async () => {
			const { chartData, fetchDataAndUpdateChart } = useSession()
			mockGet.mockResolvedValue({
				data: [
					{ time: "2024-01-01T10:00:00", value: 42, MeasurementType: { name: "ecg" } },
					{ time: "2024-01-01T10:00:01", value: 43, MeasurementType: { name: "ecg" } },
					{ time: "2024-01-01T10:00:02", value: 36, MeasurementType: { name: "temperature" } },
				],
			})
			await fetchDataAndUpdateChart("session-1")
			expect(chartData.value.datasets).toHaveLength(2)
			const ecgDataset = chartData.value.datasets.find(d => d.label === "ecg")
			expect(ecgDataset?.data).toHaveLength(2)
		})

		it("should reset chart before fetching", async () => {
			const { chartData, fetchDataAndUpdateChart } = useSession()
			mockGet.mockResolvedValueOnce({
				data: [{ time: "2024-01-01T10:00:00", value: 1, MeasurementType: { name: "ecg" } }],
			})
			await fetchDataAndUpdateChart("session-1")
			expect(chartData.value.datasets).toHaveLength(1)

			mockGet.mockResolvedValueOnce({ data: [] })
			await fetchDataAndUpdateChart("session-2")
			expect(chartData.value.datasets).toHaveLength(0)
		})

		it("should fallback to 'Unknown' measureType when MeasurementType is missing", async () => {
			const { chartData, fetchDataAndUpdateChart } = useSession()
			mockGet.mockResolvedValue({
				data: [{ time: "2024-01-01T10:00:00", value: 10, MeasurementType: null }],
			})
			await fetchDataAndUpdateChart("session-1")
			expect(chartData.value.datasets[0].label).toBe("Unknown")
		})
	})

	describe("fetchAllSessionsOfSensor()", () => {
		it("should populate sessions from API", async () => {
			const { sessions, fetchAllSessionsOfSensor } = useSession()
			mockGet.mockResolvedValue({ data: [{ id: "s1" }, { id: "s2" }] })
			await fetchAllSessionsOfSensor("sensor1")
			expect(sessions.value).toHaveLength(2)
		})

		it("should keep sessions empty on error", async () => {
			const { sessions, fetchAllSessionsOfSensor } = useSession()
			mockGet.mockRejectedValue(new Error("Network error"))
			await fetchAllSessionsOfSensor("sensor1")
			expect(sessions.value).toEqual([])
		})
	})

	describe("handleSessionSelect()", () => {
		it("should update selectedSession", () => {
			const { sessions, selectedSession, handleSessionSelect } = useSession()
			sessions.value = [{ id: "s1", createdAt: "2024-01-01", endedAt: "2024-01-02" } as any]
			handleSessionSelect("s1")
			expect(selectedSession.value).toBe("s1")
		})
	})

	describe("checkAndJoinActiveSession()", () => {
		it("should return true and start session if active session found for sensor", async () => {
			const { topic, checkAndJoinActiveSession } = useSession()
			mockGet.mockResolvedValue({ data: [{ idSensor: "sensor1" }] })
			const result = await checkAndJoinActiveSession("sensor1", "my-topic")
			expect(result).toBe(true)
			expect(topic.value).toBe("my-topic")
		})

		it("should return false if no active session matches sensor", async () => {
			const { checkAndJoinActiveSession } = useSession()
			mockGet.mockResolvedValue({ data: [{ idSensor: "other-sensor" }] })
			const result = await checkAndJoinActiveSession("sensor1", "my-topic")
			expect(result).toBe(false)
		})

		it("should return false on error", async () => {
			const { checkAndJoinActiveSession } = useSession()
			mockGet.mockRejectedValue(new Error("Network error"))
			const result = await checkAndJoinActiveSession("sensor1", "my-topic")
			expect(result).toBe(false)
		})
	})
})
