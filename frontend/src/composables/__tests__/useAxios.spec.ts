import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"

const { mockPost, handlers } = vi.hoisted(() => {
	const handlers: {
		requestSuccess?: (config: any) => any
		responseSuccess?: (response: any) => any
		responseError?: (error: any) => Promise<any>
	} = {}

	const mockPost = vi.fn()

	return { mockPost, handlers }
})

vi.mock("axios", () => {
	const mockInstance: any = {
		interceptors: {
			request: {
				use: (success: any) => {
					handlers.requestSuccess = success
				},
			},
			response: {
				use: (success: any, error: any) => {
					handlers.responseSuccess = success
					handlers.responseError = error
				},
			},
		},
		post: mockPost,
	}
	// Permet à l'intercepteur de retenter la requête originale via _axios(config)
	const axiosCallable: any = vi.fn((config: any) => mockPost(config))
	Object.assign(axiosCallable, mockInstance)

	return {
		default: {
			create: vi.fn(() => axiosCallable),
		},
	}
})

import { useAxios } from "@/composables/useAxios.composable"

describe("useAxios", () => {
	let store: Record<string, string> = {}

	beforeAll(() => {
		Object.defineProperty(window, "localStorage", {
			value: {
				getItem: (key: string) => store[key] ?? null,
				setItem: (key: string, value: string) => {
					store[key] = value
				},
				removeItem: (key: string) => {
					delete store[key]
				},
				clear: () => {
					store = {}
				},
			},
			writable: true,
		})
	})

	beforeEach(() => {
		vi.clearAllMocks()
		store = {}
	})

	it("should return an axios instance", () => {
		const { axios: instance } = useAxios()
		expect(instance).toBeDefined()
	})

	describe("request interceptor", () => {
		it("should add Authorization header if token is in localStorage", () => {
			localStorage.setItem("token", "my-token")
			const config = { headers: {} as any }
			const result = handlers.requestSuccess!(config)
			expect(result.headers["Authorization"]).toBe("Bearer my-token")
		})

		it("should not add Authorization header if no token", () => {
			const config = { headers: {} as any }
			const result = handlers.requestSuccess!(config)
			expect(result.headers["Authorization"]).toBeUndefined()
		})
	})

	describe("response interceptor", () => {
		it("should pass through successful responses", async () => {
			const response = { data: { ok: true } }
			const result = await handlers.responseSuccess!(response)
			expect(result).toEqual(response)
		})

		it("should pass through non-401 errors without refreshing", async () => {
			const error = { response: { status: 500 }, config: { headers: {} } }
			await expect(handlers.responseError!(error)).rejects.toEqual(error)
			expect(mockPost).not.toHaveBeenCalled()
		})

		it("should not retry if request already retried (_retry = true)", async () => {
			const error = {
				response: { status: 401 },
				config: { _retry: true, headers: {} },
			}
			await expect(handlers.responseError!(error)).rejects.toEqual(error)
			expect(mockPost).not.toHaveBeenCalled()
		})

		it("should call /auth/refresh on 401 and save new token", async () => {
			localStorage.setItem("token", "old-token")
			mockPost.mockResolvedValueOnce({
				data: { token: "new-token", expiresAt: Date.now() + 900000 },
			})

			const originalRequest = { headers: {} as any, _retry: false }
			const error = { response: { status: 401 }, config: originalRequest }

			await handlers.responseError!(error).catch(() => {})

			expect(localStorage.getItem("token")).toBe("new-token")
		})

		it("should redirect to / and clear localStorage if refresh fails", async () => {
			Object.defineProperty(window, "location", {
				writable: true,
				value: { href: "" },
			})
			localStorage.setItem("token", "old-token")
			mockPost.mockRejectedValueOnce(new Error("refresh failed"))

			const originalRequest = { headers: {} as any, _retry: false }
			const error = { response: { status: 401 }, config: originalRequest }

			await handlers.responseError!(error).catch(() => {})

			expect(window.location.href).toBe("/")
			expect(localStorage.getItem("token")).toBeNull()
		})
	})
})
