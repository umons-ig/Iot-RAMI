import { ref, watch } from "vue"

/**
 * Gestion du thème visuel et de l'effet CRT.
 *
 * - `theme` : "amber" (défaut) | "green" | "light" | "system"
 *   Appliqué via l'attribut `data-theme` sur <html>. "system" retire
 *   l'attribut pour laisser la préférence OS (`prefers-color-scheme`) décider.
 * - `crt` : active/désactive l'overlay CRT (scanlines + flicker) via `data-crt`.
 *
 * Les deux préférences sont persistées dans le localStorage et appliquées
 * immédiatement au <html> pour éviter tout flash au rechargement.
 */

export type ThemeName = "amber" | "green" | "light" | "system"

const THEME_KEY = "rami-theme"
const CRT_KEY = "rami-crt"

export const THEMES: { id: ThemeName; label: string; swatch: string }[] = [
	{ id: "amber", label: "Ambre phosphore", swatch: "#ff9f0a" },
	{ id: "green", label: "Vert oscilloscope", swatch: "#39ff6e" },
	{ id: "light", label: "Parchemin", swatch: "#b86e00" },
	{ id: "system", label: "Système", swatch: "linear-gradient(135deg,#ff9f0a 50%,#f2ead8 50%)" },
]

// État partagé (singleton module-level)
const theme = ref<ThemeName>("amber")
const crtEnabled = ref(false)
let initialized = false

function applyTheme(value: ThemeName) {
	const root = document.documentElement
	if (value === "system") {
		root.removeAttribute("data-theme")
	} else {
		root.setAttribute("data-theme", value)
	}
}

function applyCrt(enabled: boolean) {
	const root = document.documentElement
	if (enabled) {
		root.setAttribute("data-crt", "on")
	} else {
		root.removeAttribute("data-crt")
	}
}

export function useTheme() {
	if (!initialized) {
		initialized = true

		const storedTheme = localStorage.getItem(THEME_KEY) as ThemeName | null
		if (storedTheme && THEMES.some(t => t.id === storedTheme)) {
			theme.value = storedTheme
		}
		crtEnabled.value = localStorage.getItem(CRT_KEY) === "on"

		applyTheme(theme.value)
		applyCrt(crtEnabled.value)

		watch(theme, value => {
			localStorage.setItem(THEME_KEY, value)
			applyTheme(value)
		})
		watch(crtEnabled, value => {
			localStorage.setItem(CRT_KEY, value ? "on" : "off")
			applyCrt(value)
		})
	}

	const setTheme = (value: ThemeName) => {
		theme.value = value
	}

	const cycleTheme = () => {
		const order: ThemeName[] = ["amber", "green", "light", "system"]
		const idx = order.indexOf(theme.value)
		theme.value = order[(idx + 1) % order.length]
	}

	const toggleCrt = () => {
		crtEnabled.value = !crtEnabled.value
	}

	return { theme, crtEnabled, themes: THEMES, setTheme, cycleTheme, toggleCrt }
}
