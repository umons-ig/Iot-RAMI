<template>
	<div
		class="user-card"
		@click="selectUser">
		<div class="user-avatar">{{ initials }}</div>
		<div class="user-main">
			<div class="user-name">{{ user.firstName }} {{ user.lastName }}</div>
			<div class="user-email">{{ user.email }}</div>
		</div>
		<div class="user-meta">
			<span class="role-badge">{{ user.role }}</span>
			<span class="user-dob">{{ formatHumanReadableDate(user.dateOfBirth, true) }}</span>
		</div>
	</div>
</template>

<script lang="ts">
	import { defineComponent, computed } from "vue"
	import { EventTypes, handleEvent } from "@/composables/useUser.composable"
	import type { PropType } from "vue"
	import type { User } from "#/user"
	import { useSensor } from "@/composables/useSensor.composable"

	export default defineComponent({
		name: "UserCard",
		props: {
			user: {
				type: Object as PropType<User>,
				required: true,
			},
		},
		setup(props) {
			const { formatHumanReadableDate } = useSensor(undefined)

			const initials = computed(() => {
				const f = (props.user.firstName || "").charAt(0).toUpperCase()
				const l = (props.user.lastName || "").charAt(0).toUpperCase()
				return f + l || "?"
			})

			const selectUser = () => {
				handleEvent("emit", EventTypes.USER_SELECTED_FOR_FETCHING_SESSIONS, props.user.id)
			}

			return {
				selectUser,
				formatHumanReadableDate,
				initials,
			}
		},
	})
</script>

<style scoped>
	.user-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		border: 1px solid var(--color-border);
		padding: 0.75rem 1rem;
		background-color: var(--color-surface-secondary);
		border-radius: 0;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	.user-card:hover {
		border-color: var(--color-primary);
	}

	.user-card--selected {
		border-color: var(--color-primary);
		background-color: var(--color-primary-dim);
	}

	.user-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.user-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.user-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-email {
		font-size: 0.78rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.role-badge {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 0;
		background: var(--color-primary-dim);
		color: var(--color-primary);
		text-transform: capitalize;
	}

	.user-dob {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}
</style>
