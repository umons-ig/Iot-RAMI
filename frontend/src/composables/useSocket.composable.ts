import { io, type Socket } from "socket.io-client"

const DEFAULT_SOCKET_URL = "http://localhost:3000"

/**
 * Centralise la création de connexions Socket.io (source de vérité unique).
 *
 * L'URL est dérivée de `VITE_APP_BACK_URL` (en retirant le suffixe `/api/v1`),
 * exactement comme la NavBar — avant, useSocket lisait `VITE_SOCKET_URL` (non
 * documentée) avec un fallback `localhost:3000`, si bien qu'en prod sans cette
 * variable toutes les sockets (sensors/sessions) tombaient sur localhost alors
 * que la NavBar, elle, visait le bon hôte. Cf. PLAN_AMELIORATIONS §1.7.
 *
 * `VITE_SOCKET_URL` reste accepté comme override explicite si besoin.
 */
const SOCKET_OPTIONS = { transports: ["websocket"] }

const useSocket = () => {
	const getSocketUrl = (): string => {
		const explicit = import.meta.env.VITE_SOCKET_URL as string | undefined
		if (explicit) return explicit
		const backUrl = import.meta.env.VITE_APP_BACK_URL as string | undefined
		if (backUrl) return backUrl.replace("/api/v1", "")
		return DEFAULT_SOCKET_URL
	}

	const createSocket = (): Socket => {
		return io(getSocketUrl(), SOCKET_OPTIONS)
	}

	return {
		getSocketUrl,
		createSocket,
	}
}

export { useSocket }
