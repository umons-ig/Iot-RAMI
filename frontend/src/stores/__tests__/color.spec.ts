import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useColorStore } from "@/stores/color"

describe("useColorStore", () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it("should expose secondary color as string", () => {
		const store = useColorStore()
		expect(typeof store.secondary).toBe("string")
	})

	it("should expose secondaryHover color as string", () => {
		const store = useColorStore()
		expect(typeof store.secondaryHover).toBe("string")
	})

	it("should expose text color as string", () => {
		const store = useColorStore()
		expect(typeof store.text).toBe("string")
	})
})
