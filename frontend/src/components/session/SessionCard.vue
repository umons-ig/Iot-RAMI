<template>
	<div
		class="session-card"
		:class="{ 'session-card--active': selected }">
		<div class="session-left">
			<div
				class="session-status-bar"
				:class="{ 'bar-active': !session.endedAt }" />
		</div>
		<div class="session-info">
			<span class="session-date">{{ formatHumanReadableDate(session.createdAt, false, true) }}</span>
			<span
				v-if="session.endedAt"
				class="session-duration">
				<span class="duration-label">DUR.</span>
				{{ calculateDuration(session.createdAt, session.endedAt) }}
			</span>
			<span
				v-else
				class="session-active">
				<span class="active-dot" />
				EN COURS
			</span>
		</div>
		<button
			class="btn-replay"
			:class="{ 'btn-replay--active': selected }"
			:aria-pressed="selected"
			@click.stop="$emit('replay', session.id)">
			▷ REVOIR
		</button>
		<button
			class="btn-export"
			:class="`btn-export--${csvState}`"
			:disabled="csvState === 'loading'"
			@click.stop="handleExport(session.id)">
			<span v-if="csvState === 'loading'">…</span>
			<span v-else-if="csvState === 'done'">✓ OK</span>
			<span v-else-if="csvState === 'error'">✗ ERR</span>
			<span v-else>↓ CSV</span>
		</button>
	</div>
</template>

<script lang="ts">
	import { defineComponent, ref, onUnmounted } from "vue"
	import { useSensor } from "@/composables/useSensor.composable"
	import { useSession } from "@/composables/useSession.composable"

	export default defineComponent({
		props: {
			session: {
				type: Object,
				required: true,
			},
			selected: {
				type: Boolean,
				default: false,
			},
		},
		emits: ["replay"],
		setup() {
			const { calculateDuration, formatHumanReadableDate } = useSensor(undefined)
			const { exportSessionToCsv } = useSession()
			const csvState = ref<"idle" | "loading" | "done" | "error">("idle")
			const csvTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null)

			const handleExport = async (sessionId: string) => {
				if (csvState.value === "loading") return
				csvState.value = "loading"
				try {
					await exportSessionToCsv(sessionId)
					csvState.value = "done"
					csvTimeoutId.value = setTimeout(() => {
						csvState.value = "idle"
					}, 2000)
				} catch {
					csvState.value = "error"
					csvTimeoutId.value = setTimeout(() => {
						csvState.value = "idle"
					}, 2000)
				}
			}

			onUnmounted(() => {
				if (csvTimeoutId.value) clearTimeout(csvTimeoutId.value)
			})

			return {
				calculateDuration,
				formatHumanReadableDate,
				handleExport,
				csvState,
			}
		},
	})
</script>

<style scoped>
	.session-card {
		display: flex;
		align-items: center;
		gap: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		overflow: hidden;
		transition: border-color 0.15s, background-color 0.15s;
	}

	.session-card:hover {
		border-color: var(--color-border-bright);
		background: var(--color-surface-secondary);
	}

	.session-left {
		width: 3px;
		align-self: stretch;
		flex-shrink: 0;
	}

	.session-status-bar {
		width: 100%;
		height: 100%;
		background: var(--color-border-bright);
	}

	.bar-active {
		background: var(--color-success);
		box-shadow: 0 0 8px var(--color-success);
		animation: bar-pulse 2s ease-in-out infinite;
	}

	@keyframes bar-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.session-info {
		flex: 1;
		padding: 0.6rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.session-date {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 500px) {
		.session-date {
			white-space: normal;
			font-size: 0.68rem;
		}
	}

	.session-duration {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.duration-label {
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		opacity: 0.6;
	}

	.session-active {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--color-success);
		font-weight: 700;
		letter-spacing: 0.1em;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.active-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-success);
		box-shadow: 0 0 5px var(--color-success);
		flex-shrink: 0;
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.2;
		}
	}

	.btn-export {
		padding: 0.55rem 0.85rem;
		min-height: 2.75rem;
		margin-right: 0.75rem;
		font-size: 0.68rem;
		font-family: var(--font-mono);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: 1px solid var(--color-border-bright);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.15s;
		border-radius: 0;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.btn-export:hover:not(:disabled) {
		background: var(--color-primary-dim);
		border-color: var(--color-primary);
		color: var(--color-primary);
		box-shadow: 0 0 8px var(--color-primary-glow);
	}

	.btn-export--loading {
		opacity: 0.5;
		cursor: wait;
	}

	.btn-export.btn-export--done {
		border-color: var(--color-success);
		color: var(--color-success);
		background: var(--color-success-dim);
	}

	.btn-export.btn-export--error {
		border-color: var(--color-danger);
		color: var(--color-danger);
		background: var(--color-danger-dim);
	}

	.btn-replay {
		padding: 0.55rem 0.85rem;
		min-height: 2.75rem;
		font-size: 0.68rem;
		font-family: var(--font-mono);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: 1px solid var(--color-border-bright);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.btn-replay:hover,
	.btn-replay--active {
		background: var(--color-primary-dim);
		border-color: var(--color-primary);
		color: var(--color-primary);
		box-shadow: 0 0 8px var(--color-primary-glow);
	}

	.session-card--active {
		border-left: 2px solid var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
	}
</style>
