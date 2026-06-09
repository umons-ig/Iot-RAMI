import { io, type Socket } from "socket.io-client"

const DEFAULT_SOCKET_URL = "http://localhost:3000"

/**
 * Centralise la création de connexions Socket.io.
 * Lit l'URL depuis VITE_SOCKET_URL avec un fallback local cohérent
 * pour tous les appels (useSensor, useSession, SensorsList).
 */
const useSocket = () => {
	const getSocketUrl = (): string => {
		return import.meta.env.VITE_SOCKET_URL || DEFAULT_SOCKET_URL
	}

	const createSocket = (): Socket => {
		return io(getSocketUrl())
	}

	return {
		getSocketUrl,
		createSocket,
	}
}

export { useSocket }
