import { ref } from "vue"

/**
 * État partagé d'ouverture de la Command Palette (⌘K).
 * Permet à n'importe quel composant (NavBar, boutons…) d'ouvrir la palette
 * sans dépendre d'une ref de template ni simuler un évènement clavier.
 */

const isOpen = ref(false)

export function usePalette() {
	return {
		isOpen,
		open: () => {
			isOpen.value = true
		},
		close: () => {
			isOpen.value = false
		},
		toggle: () => {
			isOpen.value = !isOpen.value
		},
	}
}
