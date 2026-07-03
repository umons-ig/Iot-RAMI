import { defineStore } from "pinia"
import { ref } from "vue"

export const useColorStore = defineStore("color", () => {
	const style = ref<CSSStyleDeclaration>(getComputedStyle(document.body))
	const secondary = style.value.getPropertyValue("--color-secondary")
	const secondaryHover = style.value.getPropertyValue("--color-secondary-hover")
	const text = style.value.getPropertyValue("--color-text")

	return { secondary, secondaryHover, text }
})
