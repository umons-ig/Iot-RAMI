import { ref } from "vue"

/**
 * File de notifications éphémères ("toasts") au style terminal.
 * Singleton module-level : tout composant peut pousser un toast, le
 * `ToastHost` (monté une fois dans App.vue) les affiche.
 */

export type ToastLevel = "info" | "success" | "warning" | "danger"

export interface Toast {
	id: number
	level: ToastLevel
	title: string
	message?: string
	timeout: number
}

const toasts = ref<Toast[]>([])
let seq = 0

function push(level: ToastLevel, title: string, message?: string, timeout = 4000): number {
	const id = ++seq
	toasts.value.push({ id, level, title, message, timeout })
	if (timeout > 0) {
		window.setTimeout(() => dismiss(id), timeout)
	}
	return id
}

function dismiss(id: number) {
	const idx = toasts.value.findIndex(t => t.id === id)
	if (idx !== -1) toasts.value.splice(idx, 1)
}

export function useToast() {
	return {
		toasts,
		dismiss,
		info: (title: string, message?: string, timeout?: number) => push("info", title, message, timeout),
		success: (title: string, message?: string, timeout?: number) => push("success", title, message, timeout),
		warning: (title: string, message?: string, timeout?: number) => push("warning", title, message, timeout),
		danger: (title: string, message?: string, timeout?: number) => push("danger", title, message, timeout),
	}
}
