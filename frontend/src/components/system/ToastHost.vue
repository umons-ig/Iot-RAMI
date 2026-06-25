<script lang="ts" setup>
	import { useToast, type ToastLevel } from "@/composables/useToast.composable"

	const { toasts, dismiss } = useToast()

	const glyph: Record<ToastLevel, string> = {
		info: "›",
		success: "✓",
		warning: "!",
		danger: "✕",
	}
</script>

<template>
	<div
		class="toast-host"
		aria-live="polite"
		aria-atomic="true">
		<TransitionGroup name="toast">
			<div
				v-for="t in toasts"
				:key="t.id"
				class="toast"
				:class="`toast--${t.level}`"
				role="status">
				<span class="toast__glyph">{{ glyph[t.level] }}</span>
				<div class="toast__body">
					<p class="toast__title">{{ t.title }}</p>
					<p
						v-if="t.message"
						class="toast__msg">
						{{ t.message }}
					</p>
				</div>
				<button
					class="toast__close"
					aria-label="Fermer la notification"
					@click="dismiss(t.id)">
					✕
				</button>
				<span class="toast__bar" />
			</div>
		</TransitionGroup>
	</div>
</template>

<style scoped>
	.toast-host {
		position: fixed;
		bottom: var(--space-5);
		right: var(--space-5);
		z-index: var(--z-toast);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: min(360px, calc(100vw - 2rem));
		pointer-events: none;
	}

	.toast {
		position: relative;
		display: grid;
		grid-template-columns: 22px 1fr 16px;
		gap: var(--space-3);
		align-items: start;
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-border-bright);
		border-left-width: 3px;
		box-shadow: 0 8px 24px var(--color-overlay), inset 0 0 30px var(--color-primary-dim);
		font-family: var(--font-mono);
		overflow: hidden;
		pointer-events: auto;
	}

	.toast--info { border-left-color: var(--color-info); }
	.toast--success { border-left-color: var(--color-success); }
	.toast--warning { border-left-color: var(--color-warning); }
	.toast--danger { border-left-color: var(--color-danger); }

	.toast__glyph {
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.4;
	}
	.toast--info .toast__glyph { color: var(--color-info); }
	.toast--success .toast__glyph { color: var(--color-success); }
	.toast--warning .toast__glyph { color: var(--color-warning); }
	.toast--danger .toast__glyph { color: var(--color-danger); }

	.toast__title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text);
	}

	.toast__msg {
		font-size: 0.66rem;
		color: var(--color-text-muted);
		margin-top: 2px;
		line-height: 1.5;
	}

	.toast__close {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.65rem;
		padding: 0;
		line-height: 1.4;
		transition: color var(--dur-fast);
	}
	.toast__close:hover { color: var(--color-danger); }

	.toast__bar {
		position: absolute;
		left: 0;
		bottom: 0;
		height: 2px;
		width: 100%;
		background: currentColor;
		opacity: 0.4;
		transform-origin: left;
		animation: toast-bar 4s linear forwards;
	}
	.toast--info .toast__bar { color: var(--color-info); }
	.toast--success .toast__bar { color: var(--color-success); }
	.toast--warning .toast__bar { color: var(--color-warning); }
	.toast--danger .toast__bar { color: var(--color-danger); }

	@keyframes toast-bar {
		from { transform: scaleX(1); }
		to { transform: scaleX(0); }
	}

	.toast-enter-active { transition: all var(--dur-slow) var(--ease-out); }
	.toast-leave-active { transition: all var(--dur-base) var(--ease-in-out); position: absolute; }
	.toast-enter-from { opacity: 0; transform: translateX(40px); }
	.toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>
