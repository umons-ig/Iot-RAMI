<script lang="ts" setup>
	import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue"
	import { useRouter } from "vue-router"
	import { useTheme, type ThemeName } from "@/composables/useTheme.composable"
	import { useToast } from "@/composables/useToast.composable"
	import { usePalette } from "@/composables/usePalette.composable"
	import { useUser } from "@/composables/useUser.composable"

	interface Command {
		id: string
		label: string
		hint: string
		group: "Navigation" | "Apparence" | "Système"
		glyph: string
		keywords?: string
		run: () => void
	}

	const router = useRouter()
	const { setTheme, toggleCrt, crtEnabled } = useTheme()
	const toast = useToast()
	const { cleanUserLocalStorage } = useUser()

	const { isOpen } = usePalette()
	const query = ref("")
	const activeIndex = ref(0)
	const inputEl = ref<HTMLInputElement | null>(null)

	// Réinitialise et focus le champ à chaque ouverture (clavier ⌘K ou clic NavBar).
	watch(isOpen, value => {
		if (value) {
			query.value = ""
			activeIndex.value = 0
			nextTick(() => inputEl.value?.focus())
		}
	})

	const isAdmin = localStorage.getItem("role") === "admin"

	function go(path: string) {
		router.push(path)
	}

	function pickTheme(name: ThemeName, label: string) {
		setTheme(name)
		toast.success("Thème appliqué", label)
	}

	const commands = computed<Command[]>(() => {
		const base: Command[] = [
			{ id: "nav-home", label: "Tableau de bord", hint: "/home", group: "Navigation", glyph: "◈", keywords: "dashboard accueil", run: () => go("/home") },
			{ id: "nav-sensors", label: "Mes capteurs", hint: "/sensors", group: "Navigation", glyph: "⬡", keywords: "sensors devices", run: () => go("/sensors") },
			{ id: "nav-zones", label: "Zones", hint: "/zones", group: "Navigation", glyph: "▦", keywords: "zones batiment etage piece localisation parc", run: () => go("/zones") },
			{ id: "nav-history", label: "Historique", hint: "/history", group: "Navigation", glyph: "⊞", keywords: "history sessions comparaison", run: () => go("/history") },
			{ id: "nav-profile", label: "Mon profil", hint: "/user", group: "Navigation", glyph: "◎", keywords: "profile compte account", run: () => go("/user") },
		]
		if (isAdmin) {
			base.push(
				{ id: "nav-users", label: "Utilisateurs", hint: "/users/all", group: "Navigation", glyph: "⬟", keywords: "users admin", run: () => go("/users/all") },
				{ id: "nav-admin", label: "Administration", hint: "/admin", group: "Navigation", glyph: "⬠", keywords: "admin panel", run: () => go("/admin") },
			)
		}
		base.push(
			{ id: "th-amber", label: "Thème : Ambre phosphore", hint: "amber", group: "Apparence", glyph: "●", keywords: "theme couleur orange", run: () => pickTheme("amber", "Ambre phosphore") },
			{ id: "th-green", label: "Thème : Vert oscilloscope", hint: "green", group: "Apparence", glyph: "●", keywords: "theme couleur vert green", run: () => pickTheme("green", "Vert oscilloscope") },
			{ id: "th-light", label: "Thème : Parchemin", hint: "light", group: "Apparence", glyph: "○", keywords: "theme clair light parchemin", run: () => pickTheme("light", "Parchemin") },
			{ id: "th-system", label: "Thème : Système", hint: "system", group: "Apparence", glyph: "◐", keywords: "theme auto system os", run: () => pickTheme("system", "Préférence système") },
			{ id: "crt", label: crtEnabled.value ? "Désactiver l'effet CRT" : "Activer l'effet CRT", hint: "scanlines", group: "Apparence", glyph: "▤", keywords: "crt scanlines retro flicker", run: () => { toggleCrt(); toast.info("Effet CRT", crtEnabled.value ? "Activé" : "Désactivé") } },
			{ id: "logout", label: "Déconnexion", hint: "exit", group: "Système", glyph: "⏻", keywords: "logout deconnexion exit", run: () => { cleanUserLocalStorage(); router.push("/") } },
		)
		return base
	})

	const filtered = computed(() => {
		const q = query.value.trim().toLowerCase()
		if (!q) return commands.value
		return commands.value.filter(c =>
			(c.label + " " + c.hint + " " + (c.keywords ?? "")).toLowerCase().includes(q),
		)
	})

	const grouped = computed(() => {
		const groups: Record<string, Command[]> = {}
		filtered.value.forEach(c => {
			(groups[c.group] ??= []).push(c)
		})
		return groups
	})

	watch(filtered, () => {
		activeIndex.value = 0
	})

	function closePalette() {
		isOpen.value = false
	}

	function runActive() {
		const cmd = filtered.value[activeIndex.value]
		if (cmd) {
			closePalette()
			cmd.run()
		}
	}

	function move(delta: number) {
		const n = filtered.value.length
		if (n === 0) return
		activeIndex.value = (activeIndex.value + delta + n) % n
	}

	function onKeydown(e: KeyboardEvent) {
		const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
		if (isToggle) {
			e.preventDefault()
			isOpen.value = !isOpen.value
			return
		}
		if (!isOpen.value) return
		if (e.key === "Escape") { e.preventDefault(); closePalette() }
		else if (e.key === "ArrowDown") { e.preventDefault(); move(1) }
		else if (e.key === "ArrowUp") { e.preventDefault(); move(-1) }
		else if (e.key === "Enter") { e.preventDefault(); runActive() }
	}

	function flatIndex(cmd: Command): number {
		return filtered.value.indexOf(cmd)
	}

	onMounted(() => window.addEventListener("keydown", onKeydown))
	onUnmounted(() => window.removeEventListener("keydown", onKeydown))
</script>

<template>
	<Transition name="palette">
		<div
			v-if="isOpen"
			class="palette-backdrop"
			@click.self="closePalette">
			<div
				class="palette"
				role="dialog"
				aria-modal="true"
				aria-label="Palette de commandes">
				<div class="palette__search">
					<span class="palette__prompt">RAMI&gt;</span>
					<input
						ref="inputEl"
						v-model="query"
						class="palette__input"
						type="text"
						placeholder="Rechercher une commande…"
						aria-label="Rechercher une commande"
						autocomplete="off"
						spellcheck="false" />
					<kbd class="palette__esc">ESC</kbd>
				</div>

				<div class="palette__results">
					<template
						v-for="(cmds, group) in grouped"
						:key="group">
						<p class="palette__group">{{ group }}</p>
						<button
							v-for="cmd in cmds"
							:key="cmd.id"
							class="palette__item"
							:class="{ active: flatIndex(cmd) === activeIndex }"
							@click="closePalette(); cmd.run()"
							@mousemove="activeIndex = flatIndex(cmd)">
							<span class="palette__glyph">{{ cmd.glyph }}</span>
							<span class="palette__label">{{ cmd.label }}</span>
							<span class="palette__hint">{{ cmd.hint }}</span>
						</button>
					</template>

					<p
						v-if="filtered.length === 0"
						class="palette__empty">
						AUCUN RÉSULTAT POUR « {{ query }} »
					</p>
				</div>

				<div class="palette__footer">
					<span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
					<span><kbd>↵</kbd> exécuter</span>
					<span><kbd>⌘</kbd><kbd>K</kbd> ouvrir / fermer</span>
				</div>
			</div>
		</div>
	</Transition>
</template>

<style scoped>
	.palette-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-palette);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 14vh;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(3px);
	}

	.palette {
		width: min(620px, calc(100vw - 2rem));
		background: var(--color-surface);
		border: 1px solid var(--color-primary);
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 0 40px var(--color-primary-dim), inset 0 0 60px var(--color-primary-dim);
		font-family: var(--font-mono);
		display: flex;
		flex-direction: column;
		max-height: 70vh;
	}

	.palette__search {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		border-bottom: 1px solid var(--color-border-bright);
	}

	.palette__prompt {
		color: var(--color-primary);
		font-weight: 700;
		font-size: 0.85rem;
		text-shadow: 0 0 8px var(--color-primary-glow);
		flex-shrink: 0;
	}

	.palette__input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		letter-spacing: 0.02em;
		caret-color: var(--color-primary);
	}
	.palette__input::placeholder { color: var(--color-text-muted); }

	.palette__esc {
		font-size: 0.55rem;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border-bright);
		padding: 2px 6px;
		letter-spacing: 0.1em;
	}

	.palette__results {
		overflow-y: auto;
		padding: var(--space-2) 0;
	}

	.palette__group {
		font-size: 0.55rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		padding: var(--space-3) var(--space-4) var(--space-1);
	}

	.palette__item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-2) var(--space-4);
		background: none;
		border: none;
		border-left: 2px solid transparent;
		cursor: pointer;
		text-align: left;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		transition: color var(--dur-fast), background var(--dur-fast);
	}

	.palette__item.active {
		color: var(--color-primary);
		background: var(--color-primary-dim);
		border-left-color: var(--color-primary);
	}

	.palette__glyph { width: 18px; text-align: center; flex-shrink: 0; }
	.palette__label { flex: 1; font-size: 0.78rem; letter-spacing: 0.03em; }
	.palette__hint {
		font-size: 0.6rem;
		color: var(--color-text-muted);
		opacity: 0.7;
	}
	.palette__item.active .palette__hint { color: var(--color-primary); opacity: 0.8; }

	.palette__empty {
		padding: var(--space-6) var(--space-4);
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
	}

	.palette__footer {
		display: flex;
		gap: var(--space-5);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-border-bright);
		font-size: 0.58rem;
		color: var(--color-text-muted);
		letter-spacing: 0.05em;
	}

	.palette__footer kbd {
		border: 1px solid var(--color-border-bright);
		padding: 1px 4px;
		margin-right: 2px;
		font-size: 0.55rem;
	}

	.palette-enter-active { transition: opacity var(--dur-base) var(--ease-out); }
	.palette-leave-active { transition: opacity var(--dur-fast) var(--ease-in-out); }
	.palette-enter-from, .palette-leave-to { opacity: 0; }
	.palette-enter-active .palette { transition: transform var(--dur-base) var(--ease-out); }
	.palette-enter-from .palette { transform: translateY(-12px) scale(0.98); }
</style>
