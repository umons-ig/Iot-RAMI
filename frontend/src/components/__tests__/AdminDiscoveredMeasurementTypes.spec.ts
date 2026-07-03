import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"

// Les mocks vi.mock sont hoistés avant les imports — on déclare les fns ici
// pour pouvoir les reconfigurer dans chaque test via mockResolvedValue.
const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock("@/composables/useAxios.composable", () => ({
	useAxios: () => ({
		axios: {
			get: mockGet,
			post: mockPost,
		},
	}),
}))

import AdminDiscoveredMeasurementTypes from "@/components/AdminDiscoveredMeasurementTypes.vue"

// Fixture réutilisable
const FIXTURE_ITEMS = [
	{
		measurementType: "temperature",
		firstSeenAt: "2026-03-01T10:00:00.000Z",
		lastSeenAt: "2026-03-10T15:30:00.000Z",
		count: 42,
	},
	{
		measurementType: "humidity",
		firstSeenAt: "2026-03-02T08:00:00.000Z",
		lastSeenAt: "2026-03-10T16:00:00.000Z",
		count: 17,
	},
]

describe("AdminDiscoveredMeasurementTypes", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// ------------------------------------------------------------------
	// Affichage liste vide
	// ------------------------------------------------------------------
	describe("liste vide", () => {
		it("affiche le message vide quand GET retourne []", async () => {
			mockGet.mockResolvedValue({ data: [] })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			expect(wrapper.find(".empty-state").exists()).toBe(true)
			expect(wrapper.find(".empty-state").text()).toBe("AUCUN NOUVEAU TYPE DE MESURE DÉTECTÉ")
		})

		it("n'affiche pas le tableau quand la liste est vide", async () => {
			mockGet.mockResolvedValue({ data: [] })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			expect(wrapper.find("table").exists()).toBe(false)
		})
	})

	// ------------------------------------------------------------------
	// Affichage avec données
	// ------------------------------------------------------------------
	describe("liste avec données", () => {
		it("affiche le tableau quand GET retourne des items", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			expect(wrapper.find("table").exists()).toBe(true)
			expect(wrapper.find(".empty-state").exists()).toBe(false)
		})

		it("affiche une ligne par item retourné", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			const rows = wrapper.findAll("tbody tr")
			expect(rows).toHaveLength(FIXTURE_ITEMS.length)
		})

		it("affiche le nom du type de mesure dans chaque ligne", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			const typeCells = wrapper.findAll(".type-cell")
			expect(typeCells[0].text()).toBe("temperature")
			expect(typeCells[1].text()).toBe("humidity")
		})

		it("affiche le compteur de messages dans chaque ligne", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			const countCells = wrapper.findAll(".count-cell")
			expect(countCells[0].text()).toBe("42")
			expect(countCells[1].text()).toBe("17")
		})

		it("affiche un bouton AJOUTER par ligne", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			const buttons = wrapper.findAll(".btn-register")
			expect(buttons).toHaveLength(FIXTURE_ITEMS.length)
			buttons.forEach(btn => expect(btn.text()).toBe("AJOUTER"))
		})
	})

	// ------------------------------------------------------------------
	// Appel fetch au montage
	// ------------------------------------------------------------------
	describe("fetch au montage", () => {
		it("appelle GET measurementTypes/discovered au montage", async () => {
			mockGet.mockResolvedValue({ data: [] })

			mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			expect(mockGet).toHaveBeenCalledTimes(1)
			expect(mockGet).toHaveBeenCalledWith("measurementTypes/discovered")
		})
	})

	// ------------------------------------------------------------------
	// Bouton RAFRAÎCHIR
	// ------------------------------------------------------------------
	describe("bouton RAFRAÎCHIR", () => {
		it("rappelle GET measurementTypes/discovered au clic", async () => {
			mockGet.mockResolvedValue({ data: [] })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			await wrapper.find(".btn-refresh").trigger("click")
			await flushPromises()

			expect(mockGet).toHaveBeenCalledTimes(2)
			expect(mockGet).toHaveBeenNthCalledWith(2, "measurementTypes/discovered")
		})

		it("met à jour la liste après le rafraîchissement", async () => {
			// Premier appel : liste vide
			mockGet.mockResolvedValueOnce({ data: [] })
			// Deuxième appel : liste avec un item
			mockGet.mockResolvedValueOnce({ data: [FIXTURE_ITEMS[0]] })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			expect(wrapper.find("table").exists()).toBe(false)

			await wrapper.find(".btn-refresh").trigger("click")
			await flushPromises()

			expect(wrapper.find("table").exists()).toBe(true)
			expect(wrapper.findAll("tbody tr")).toHaveLength(1)
		})
	})

	// ------------------------------------------------------------------
	// Bouton AJOUTER — cas nominal
	// ------------------------------------------------------------------
	describe("bouton AJOUTER — cas nominal", () => {
		it("appelle POST measurementTypes avec le bon name", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })
			mockPost.mockResolvedValue({})

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			await wrapper.findAll(".btn-register")[0].trigger("click")
			await flushPromises()

			expect(mockPost).toHaveBeenCalledWith("measurementTypes", { name: "temperature" })
		})

		it("rafraîchit la liste après un POST réussi", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })
			mockPost.mockResolvedValue({})

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			// 1 appel au montage
			expect(mockGet).toHaveBeenCalledTimes(1)

			await wrapper.findAll(".btn-register")[0].trigger("click")
			await flushPromises()

			// 1 appel supplémentaire après POST
			expect(mockGet).toHaveBeenCalledTimes(2)
		})

		it("n'affiche pas d'erreur après un POST réussi", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })
			mockPost.mockResolvedValue({})

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			await wrapper.findAll(".btn-register")[0].trigger("click")
			await flushPromises()

			expect(wrapper.find(".inline-error").exists()).toBe(false)
		})

		it("désactive le bouton pendant le POST et le réactive ensuite", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })

			// POST qui se résout après que l'on ait vérifié l'état intermédiaire
			let resolvePost!: () => void
			mockPost.mockReturnValue(
				new Promise<void>(res => {
					resolvePost = res
				})
			)

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			const firstButton = wrapper.findAll(".btn-register")[0]
			firstButton.trigger("click")

			// Pendant le POST : bouton désactivé et texte "…"
			await wrapper.vm.$nextTick()
			expect((firstButton.element as HTMLButtonElement).disabled).toBe(true)
			expect(firstButton.text()).toBe("…")

			// On résout le POST et on attend la fin
			resolvePost()
			await flushPromises()

			// Après : bouton réactivé
			expect((firstButton.element as HTMLButtonElement).disabled).toBe(false)
			expect(firstButton.text()).toBe("AJOUTER")
		})
	})

	// ------------------------------------------------------------------
	// Gestion des erreurs POST 401 / 403
	// ------------------------------------------------------------------
	describe("gestion erreurs 401/403", () => {
		it("affiche le message d'erreur inline sur 401", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })
			mockPost.mockRejectedValue({ response: { status: 401 } })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			await wrapper.findAll(".btn-register")[0].trigger("click")
			await flushPromises()

			const errorEl = wrapper.find(".inline-error")
			expect(errorEl.exists()).toBe(true)
			expect(errorEl.text()).toContain("ACCÈS REFUSÉ")
		})

		it("affiche le message d'erreur inline sur 403", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })
			mockPost.mockRejectedValue({ response: { status: 403 } })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			await wrapper.findAll(".btn-register")[0].trigger("click")
			await flushPromises()

			const errorEl = wrapper.find(".inline-error")
			expect(errorEl.exists()).toBe(true)
			expect(errorEl.text()).toContain("ACCÈS REFUSÉ")
		})

		it("n'affiche pas d'erreur inline sur une erreur 500 (log seulement)", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })
			mockPost.mockRejectedValue({ response: { status: 500 } })

			// On supprime console.error pour éviter le bruit dans la console de test
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			await wrapper.findAll(".btn-register")[0].trigger("click")
			await flushPromises()

			expect(wrapper.find(".inline-error").exists()).toBe(false)
			consoleSpy.mockRestore()
		})

		it("ne rafraîchit pas la liste après un POST en erreur 401", async () => {
			mockGet.mockResolvedValue({ data: FIXTURE_ITEMS })
			mockPost.mockRejectedValue({ response: { status: 401 } })

			const wrapper = mount(AdminDiscoveredMeasurementTypes)
			await flushPromises()

			expect(mockGet).toHaveBeenCalledTimes(1)

			await wrapper.findAll(".btn-register")[0].trigger("click")
			await flushPromises()

			// Aucun GET supplémentaire car POST a échoué avant le refresh
			expect(mockGet).toHaveBeenCalledTimes(1)
		})
	})
})
