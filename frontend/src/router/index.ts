import { createRouter, createWebHistory } from "vue-router"

import { useUser } from "@/composables/useUser.composable"

const { cleanUserLocalStorage, canAccessAdminPanel } = useUser()

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/",
			name: "login",
			component: () => import("@/views/user/LoginFormView.vue"),
		},
		{
			path: "/home",
			name: "home",
			component: () => import("@/views/user/DashboardView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/admin",
			name: "admin",
			component: () => import("@/views/AdminView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/sensor/:id",
			name: "SensorDetail",
			component: () => import("@/views/sensor/SensorDetailView.vue"),
			meta: {
				requiresAuth: true,
			},
			props: true,
		},
		/*******	USER	*********/
		{
			path: "/user",
			name: "user",
			component: () => import("@/views/UserView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/user/update",
			name: "userUpdate",
			component: () => import("@/views/user/UpdateUserView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/users/all",
			component: () => import("@/views/user/UsersSessionsView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/signup",
			name: "signup",
			component: () => import("@/views/user/SignupFormView.vue"),
		},
		{
			path: "/sensors",
			name: "sensors",
			component: () => import("@/views/sensor/SensorsView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/sensor/:id/new",
			name: "newsession",
			component: () => import("@/views/sensor/SensorSessionView.vue"),
			meta: {
				requiresAuth: true,
			},
			props: true,
		},
		{
			path: "/history",
			name: "history",
			component: () => import("@/views/history/HistoryView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/zones",
			name: "zones",
			component: () => import("@/views/zone/ZonesView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
		{
			path: "/teams",
			name: "teams",
			component: () => import("@/views/team/TeamsView.vue"),
			meta: {
				requiresAuth: true,
			},
		},
	],
})

router.beforeEach(async (to, from, next) => {
	const requiresAuth = to.matched.some(record => record.meta.requiresAuth) // Check if the route requires authentication
	const token = localStorage.getItem("token")
	const expires_at = localStorage.getItem("expiresAt")

	if (!requiresAuth) {
		// If the route does not require authentication, continue
		return next()
	}

	if (!token || !expires_at) {
		cleanUserLocalStorage()
		return next("/")
	}
	if (token && Number(expires_at) < Date.now()) {
		// If the token is expired, clean the local storage and redirect to log in
		cleanUserLocalStorage()
		return next("/")
	}
	if (to.name === "admin" || to.name === "teams") {
		const res = await canAccessAdminPanel()
		if (!res || !res.canAccess) {
			return next("/")
		}
		return next()
	}
	// If the token is valid, continue
	return next()
})

export default router
