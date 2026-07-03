import { ref } from "vue"

type EventCallback = (payload: any) => void

const useEventBus = () => {
	const listeners = ref<{ [key: string]: EventCallback[] }>({})

	const on = (event: string, callback: EventCallback) => {
		if (!listeners.value[event]) {
			listeners.value[event] = []
		}
		listeners.value[event].push(callback)
	}

	const off = (event: string, callback: EventCallback) => {
		if (!listeners.value[event]) return
		listeners.value[event] = listeners.value[event].filter(listener => listener !== callback)
	}

	const emit = (event: string, payload: any) => {
		if (!listeners.value[event]) return
		listeners.value[event].forEach(callback => callback(payload))
	}

	return { on, off, emit }
}

// Singleton instance
let eventBusInstance: ReturnType<typeof useEventBus> | null = null

export const getEventBus = () => {
	if (!eventBusInstance) {
		eventBusInstance = useEventBus()
	}
	return eventBusInstance
}

export type { EventCallback }
