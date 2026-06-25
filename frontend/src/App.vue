<script lang="ts" setup>
	import { RouterView } from "vue-router"
	import NavBar from "@/components/NavBar.vue"
	import CommandPalette from "@/components/system/CommandPalette.vue"
	import ToastHost from "@/components/system/ToastHost.vue"
	import { useTheme } from "@/composables/useTheme.composable"

	// Applique le thème + l'effet CRT persistés dès le montage de l'app.
	useTheme()
</script>

<template>
	<div class="app-container">
		<NavBar />
		<main class="content">
			<RouterView />
		</main>
		<CommandPalette />
		<ToastHost />
	</div>
</template>

<style lang="scss">
	.app-container {
		display: flex;
		height: 100vh;
		background: var(--color-background);
		/* Texture scanline subtile */
		background-image: repeating-linear-gradient(to bottom, transparent, transparent 3px, var(--color-overlay-light) 3px, var(--color-overlay-light) 4px);
	}

	.content {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding: 2rem 2.5rem;
		overflow-y: auto;
		background-color: transparent;
		background-image: radial-gradient(ellipse 100% 50% at 50% 0%, var(--color-primary-glow) 0%, transparent 65%), linear-gradient(var(--color-primary-dim) 1px, transparent 1px),
			linear-gradient(90deg, var(--color-primary-dim) 1px, transparent 1px);
		background-size: 100% 100%, 40px 40px, 40px 40px;
	}

	@media (max-width: 768px) {
		.content {
			padding: 1rem;
			padding-top: 4.5rem;
		}
	}
</style>
