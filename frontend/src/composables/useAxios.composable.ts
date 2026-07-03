import axios from "axios"

const config = {
	baseURL: import.meta.env.VITE_APP_BACK_URL as string,
	withCredentials: true, // nécessaire pour envoyer/recevoir les cookies HttpOnly
}

const _axios = axios.create(config)

_axios.interceptors.request.use(
	function (config) {
		const token = localStorage.getItem("token")
		if (token) {
			config.headers["Authorization"] = `Bearer ${token}`
		}
		return config
	},
	function (error) {
		return Promise.reject(error)
	}
)

// Flag pour éviter une boucle infinie si /auth/refresh retourne aussi 401
let isRefreshing = false

_axios.interceptors.response.use(
	function (response) {
		return response
	},
	async function (error) {
		const originalRequest = error.config

		// Si 401 et qu'on n'est pas déjà en train de refresh et que ce n'est pas la route refresh elle-même
		if (error.response?.status === 401 && !isRefreshing && !originalRequest._retry) {
			isRefreshing = true
			originalRequest._retry = true

			try {
				const { data } = await _axios.post("/auth/refresh")
				// Sauvegarder le nouveau token
				localStorage.setItem("token", data.token)
				if (data.expiresAt) {
					localStorage.setItem("expiresAt", data.expiresAt.toString())
				}
				// Mettre à jour le header et retenter la requête originale
				originalRequest.headers["Authorization"] = `Bearer ${data.token}`
				return _axios(originalRequest)
			} catch (_refreshError) {
				// Le refresh a échoué → session expirée, on déconnecte
				localStorage.clear()
				window.location.href = "/"
				return Promise.reject(_refreshError)
			} finally {
				isRefreshing = false
			}
		}

		return Promise.reject(error)
	}
)

const useAxios = () => {
	return {
		axios: _axios,
	}
}

export { useAxios }
