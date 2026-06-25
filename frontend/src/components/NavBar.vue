<template>
	<div
		v-if="isOpen"
		class="sidebar-overlay"
		@click="isOpen = false" />

	<button
		class="hamburger"
		aria-label="Menu"
		@click="isOpen = !isOpen">
		<span />
		<span />
		<span />
	</button>

	<aside
		class="sidebar"
		:class="{ open: isOpen }">
		<!-- Header -->
		<div class="sidebar-header">
			<div class="sidebar-logo">
				<span class="logo-bracket">[</span>
				<span class="logo-text">RAMI</span>
				<span class="logo-bracket">]</span>
			</div>
			<p class="logo-sub">SENSOR MONITOR v1.0</p>
			<button
				class="close-btn"
				aria-label="Close menu"
				@click="isOpen = false">
				✕
			</button>
		</div>

		<div class="sidebar-divider" />

		<!-- Navigation -->
		<nav class="sidebar-nav">
			<ul>
				<li
					v-for="(item, index) in items"
					:key="index">
					<router-link
						:class="[isActive(item.path) ? 'active-link' : '']"
						:to="item.path"
						@click="closeSidebarOnMobile">
						<span class="nav-icon">{{ item.icon }}</span>
						<span class="nav-label">{{ item.name }}</span>
					</router-link>
				</li>
			</ul>
		</nav>

		<!-- Footer -->
		<div class="sidebar-footer">
			<!-- Poste de commande -->
			<button
				class="cmd-btn"
				@click="openPalette">
				<span class="cmd-btn__label">COMMANDES</span>
				<span class="cmd-btn__keys"><kbd>⌘</kbd><kbd>K</kbd></span>
			</button>

			<div class="deck">
				<div
					class="theme-swatches"
					role="group"
					aria-label="Choix du thème">
					<button
						v-for="t in themes"
						:key="t.id"
						class="swatch"
						:class="{ active: theme === t.id }"
						:style="{ background: t.swatch }"
						:title="t.label"
						:aria-label="`Thème ${t.label}`"
						:aria-pressed="theme === t.id"
						@click="setTheme(t.id)" />
				</div>
				<button
					class="crt-toggle"
					:class="{ on: crtEnabled }"
					:aria-pressed="crtEnabled"
					title="Effet CRT (scanlines)"
					@click="toggleCrt">
					CRT
				</button>
			</div>

			<div class="footer-top">
				<div class="system-status">
					<span class="status-dot" />
					<span class="status-label">SYS ONLINE</span>
				</div>
				<button
					v-if="alertCount > 0"
					class="alert-badge"
					:title="`${alertCount} alerte(s) de seuil`"
					@click="toggleAlertPanel">
					⚠ {{ alertCount }}
				</button>
			</div>

			<!-- Panel alertes -->
			<div
				v-if="showAlertPanel && alerts.length > 0"
				class="alert-panel">
				<div class="alert-panel-header">
					<span>ALERTES SEUIL</span>
					<button
						class="alert-clear"
						@click="clearAlerts">
						EFFACER
					</button>
				</div>
				<div class="alert-list">
					<div
						v-for="(alert, i) in alerts.slice(0, 10)"
						:key="i"
						class="alert-item"
						:class="alert.direction">
						<span class="alert-dir">{{ formatAlertDirection(alert.direction) }}</span>
						<span class="alert-type">{{ alert.measureType }}</span>
						<span class="alert-val">{{ alert.value.toFixed(2) }}</span>
					</div>
				</div>
			</div>

			<button
				class="logout-button"
				@click="logout">
				<span>⏻</span> DÉCONNECTER
			</button>
		</div>
	</aside>
</template>

<script lang="ts">
	import { defineComponent, reactive, ref, onMounted, onUnmounted } from "vue"
	import { io } from "socket.io-client"
	import { useUser } from "@/composables/useUser.composable"
	import { useAlert } from "@/composables/useAlert.composable"
	import { useTheme } from "@/composables/useTheme.composable"
	import { usePalette } from "@/composables/usePalette.composable"

	const { cleanUserLocalStorage } = useUser()

	interface DataComponent {
		items: MenuItem[]
		isOpen: boolean
		showAlertPanel: boolean
	}

	interface MenuItem {
		path: string
		name: string
		icon: string
	}

	export default defineComponent({
		name: "NavBar",
		setup() {
			const { alerts, alertCount, listenToAlerts, clearAlerts } = useAlert()
			const { theme, crtEnabled, themes, setTheme, toggleCrt } = useTheme()
			const { open: openPalette } = usePalette()
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const socket = ref<any | null>(null)

			onMounted(() => {
				const token = localStorage.getItem("token")
				if (!token) return
				const backUrl = import.meta.env.VITE_APP_BACK_URL as string
				const socketUrl = backUrl.replace("/api/v1", "")
				socket.value = io(socketUrl, { transports: ["websocket"] })
				socket.value.emit("join-user-room", { token })
				listenToAlerts(socket.value)
			})

			onUnmounted(() => {
				socket.value?.disconnect()
			})

			return { alerts, alertCount, clearAlerts, theme, crtEnabled, themes, setTheme, toggleCrt, openPalette }
		},
		data(): DataComponent {
			const role = localStorage.getItem("role")
			const isAdmin = role === "admin"
			const isOpen = window.innerWidth > 768

			const items: MenuItem[] = [
				{ path: "/home", name: "Dashboard", icon: "◈" },
				{ path: "/sensors", name: "Mes capteurs", icon: "⬡" },
				{ path: "/history", name: "Historique", icon: "⊞" },
				{ path: "/user", name: "Mon profil", icon: "◎" },
			]

			if (isAdmin) {
				items.push({ path: "/users/all", name: "Utilisateurs", icon: "⬟" })
				items.push({ path: "/admin", name: "Administration", icon: "⬠" })
			}

			return { items: reactive(items), isOpen, showAlertPanel: false }
		},
		methods: {
			isActive(path: string): boolean {
				return this.$route.path === path
			},
			logout() {
				cleanUserLocalStorage()
				this.$router.push("/")
			},
			closeSidebarOnMobile() {
				if (window.innerWidth <= 768) {
					this.isOpen = false
				}
			},
			toggleAlertPanel() {
				this.showAlertPanel = !this.showAlertPanel
			},
			formatAlertDirection(direction: "min" | "max"): string {
				return direction === "min" ? "↓ MIN" : "↑ MAX"
			},
		},
	})
</script>

<style scoped>
	/* ── Sidebar ── */
	.sidebar {
		width: 220px;
		min-width: 220px;
		background-color: var(--color-sidebar-bg);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		padding: 0;
		box-sizing: border-box;
		overflow: hidden;
	}

	/* ── Header ── */
	.sidebar-header {
		padding: 1.5rem 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sidebar-logo {
		display: flex;
		align-items: baseline;
		gap: 1px;
		line-height: 1;
	}

	.logo-bracket {
		font-family: var(--font-mono);
		font-size: 1.4rem;
		color: var(--color-primary);
		font-weight: 700;
		opacity: 0.6;
	}

	.logo-text {
		font-family: var(--font-display);
		font-size: 2.2rem;
		font-weight: 900;
		color: var(--color-primary);
		letter-spacing: 0.12em;
		text-shadow: 0 0 24px var(--color-primary-glow), 0 0 2px rgba(255, 159, 10, 0.4);
		line-height: 1;
	}

	.logo-sub {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--color-sidebar-text);
		letter-spacing: 0.15em;
		text-transform: uppercase;
		font-weight: 400;
		margin-top: 4px;
		opacity: 0.8;
	}

	.close-btn {
		display: none;
	}

	.sidebar-divider {
		height: 1px;
		background: linear-gradient(to right, var(--color-primary-dim), var(--color-border), transparent);
		margin: 0 1.25rem 1rem;
		flex-shrink: 0;
	}

	/* ── Navigation ── */
	.sidebar-nav {
		flex: 1;
		padding: 0 0.5rem;
	}

	.sidebar-nav ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sidebar-nav ul li a {
		text-decoration: none;
		color: var(--color-sidebar-text);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-weight: 400;
		transition: color 0.15s, background-color 0.15s;
		border-left: 2px solid transparent;
	}

	.nav-icon {
		font-size: 0.9rem;
		width: 16px;
		text-align: center;
		flex-shrink: 0;
	}

	.nav-label {
		flex: 1;
	}

	.sidebar-nav ul li a:hover {
		background-color: var(--color-sidebar-hover);
		color: var(--color-primary);
		border-left-color: var(--color-primary-glow);
	}

	.sidebar-nav ul li a.active-link {
		color: var(--color-primary);
		background-color: var(--color-primary-dim);
		border-left-color: var(--color-primary);
		font-weight: 700;
		box-shadow: inset 0 0 24px rgba(255, 159, 10, 0.08);
		text-shadow: 0 0 8px var(--color-primary-glow);
	}

	.sidebar-nav ul li a.active-link .nav-icon {
		text-shadow: 0 0 10px var(--color-primary);
	}

	/* ── Footer ── */
	.sidebar-footer {
		padding: 1rem 1.25rem 1.5rem;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* ── Poste de commande ── */
	.cmd-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem 0.65rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border-bright);
		cursor: pointer;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		transition: color var(--dur-fast), border-color var(--dur-fast), box-shadow var(--dur-fast);
	}

	.cmd-btn:hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
		box-shadow: inset 0 0 18px var(--color-primary-dim);
	}

	.cmd-btn__keys {
		display: flex;
		gap: 2px;
	}

	.cmd-btn__keys kbd,
	.cmd-btn__label {
		font-family: var(--font-mono);
	}

	.cmd-btn__keys kbd {
		border: 1px solid var(--color-border-bright);
		padding: 0 4px;
		font-size: 0.6rem;
		color: var(--color-text-muted);
	}

	.deck {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.theme-swatches {
		display: flex;
		gap: 6px;
	}

	.swatch {
		width: 16px;
		height: 16px;
		border: 1px solid var(--color-border-bright);
		border-radius: 50%;
		cursor: pointer;
		padding: 0;
		transition: transform var(--dur-fast), box-shadow var(--dur-fast);
	}

	.swatch:hover {
		transform: scale(1.15);
	}

	.swatch.active {
		border-color: var(--color-text);
		box-shadow: 0 0 0 2px var(--color-background), 0 0 0 3px var(--color-primary);
	}

	.crt-toggle {
		padding: 2px 8px;
		background: none;
		border: 1px solid var(--color-border-bright);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all var(--dur-fast);
	}

	.crt-toggle.on {
		color: var(--color-primary);
		border-color: var(--color-primary);
		box-shadow: inset 0 0 12px var(--color-primary-dim), 0 0 8px var(--color-primary-glow);
		text-shadow: 0 0 6px var(--color-primary-glow);
	}

	.footer-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.system-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.alert-badge {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: var(--color-danger-dim);
		border: 1px solid var(--color-danger);
		color: var(--color-danger);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		cursor: pointer;
		border-radius: 0;
		animation: alert-pulse 1.5s ease-in-out infinite;
	}

	@keyframes alert-pulse {
		0%,
		100% {
			box-shadow: 0 0 4px rgba(255, 64, 64, 0.3);
		}
		50% {
			box-shadow: 0 0 10px rgba(255, 64, 64, 0.6);
		}
	}

	.alert-panel {
		background: var(--color-surface);
		border: 1px solid var(--color-danger);
		border-radius: 0;
		overflow: hidden;
	}

	.alert-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 8px;
		background: var(--color-danger-dim);
		font-family: var(--font-mono);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--color-danger);
	}

	.alert-clear {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.55rem;
		cursor: pointer;
		letter-spacing: 0.08em;
		padding: 0;
	}

	.alert-clear:hover {
		color: var(--color-danger);
	}

	.alert-list {
		max-height: 180px;
		overflow-y: auto;
	}

	.alert-item {
		display: grid;
		grid-template-columns: 44px 1fr auto;
		gap: 4px;
		align-items: center;
		padding: 4px 8px;
		border-bottom: 1px solid var(--color-border);
		font-family: var(--font-mono);
		font-size: 0.58rem;
	}

	.alert-item:last-child {
		border-bottom: none;
	}

	.alert-dir {
		font-weight: 700;
	}

	.alert-item.min .alert-dir {
		color: var(--color-info);
	}
	.alert-item.max .alert-dir {
		color: var(--color-danger);
	}

	.alert-type {
		color: var(--color-text-muted);
		text-transform: uppercase;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.alert-val {
		color: var(--color-text);
		font-weight: 700;
	}

	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-success);
		box-shadow: 0 0 6px var(--color-success);
		flex-shrink: 0;
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
			box-shadow: 0 0 6px var(--color-success);
		}
		50% {
			opacity: 0.6;
			box-shadow: 0 0 2px var(--color-success);
		}
	}

	.status-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-success);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 600;
	}

	.logout-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.55rem;
		background-color: transparent;
		border: 1px solid var(--color-border-bright);
		cursor: pointer;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		transition: all 0.15s;
		border-radius: 0;
	}

	.logout-button:hover {
		background-color: var(--color-danger-dim);
		border-color: var(--color-danger);
		color: var(--color-danger);
		box-shadow: 0 0 10px rgba(255, 64, 64, 0.15);
	}

	/* ── Hamburger ── */
	.hamburger {
		display: none;
	}

	.sidebar-overlay {
		display: none;
	}

	/* ── Mobile ── */
	@media (max-width: 768px) {
		.hamburger {
			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 5px;
			position: fixed;
			top: 0.5rem;
			left: 0.5rem;
			z-index: 200;
			width: 2.75rem;
			height: 2.75rem;
			background: none;
			border: none;
			cursor: pointer;
			padding: 0.65rem 0.5rem;
		}

		.hamburger span {
			display: block;
			width: 100%;
			height: 2px;
			background-color: var(--color-primary);
			border-radius: 0;
			flex-shrink: 0;
		}

		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			height: 100vh;
			z-index: 100;
			transform: translateX(-100%);
			transition: transform 0.25s ease;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-overlay {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.7);
			z-index: 99;
		}

		.close-btn {
			display: block;
			position: absolute;
			top: 1.5rem;
			right: 1.25rem;
			background: none;
			border: none;
			color: var(--color-text-muted);
			font-size: 1rem;
			cursor: pointer;
			padding: 0.25rem;
		}

		.close-btn:hover {
			color: var(--color-primary);
		}
	}
</style>
