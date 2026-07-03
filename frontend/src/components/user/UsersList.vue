<template>
	<div class="users-list-view">
		<div class="header">
			<h2 v-if="totalUsers > 0">{{ totalUsers }} utilisateur{{ totalUsers !== 1 ? "s" : "" }}</h2>
			<h2 v-else>Aucun utilisateur accessible.</h2>
			<hr />
		</div>
		<div
			v-if="totalUsers > 0"
			class="users-list">
			<UserCard
				v-for="user in users"
				:key="user.id"
				:user="user"
				:class="{ 'user-card--selected': selectedUser === user.id }" />
		</div>
	</div>
</template>

<script lang="ts">
	import { ref, defineComponent, onMounted, onUnmounted } from "vue"
	import type { User } from "#/user"
	import { useUser } from "@/composables/useUser.composable"
	import UserCard from "@/components/user/UserCard.vue"
	import { EventTypes, handleEvent } from "@/composables/useUser.composable"

	export default defineComponent({
		name: "UsersListView",
		components: {
			UserCard,
		},
		setup() {
			const users = ref<User[]>([])
			const totalUsers = ref(0)
			const selectedUser = ref<string | null>(null)
			const { getAllUsers } = useUser()

			const fetchUsers = async () => {
				try {
					const usersData = await getAllUsers()
					users.value = usersData
					totalUsers.value = usersData.length
				} catch (error) {
					console.error("Error fetching users:", error)
				}
			}

			const handleUserSelect = (userId: string) => {
				selectedUser.value = userId
			}

			onMounted(() => {
				fetchUsers()
				handleEvent("on", EventTypes.USER_SELECTED_FOR_FETCHING_SESSIONS, handleUserSelect)
			})

			onUnmounted(() => {
				handleEvent("off", EventTypes.USER_SELECTED_FOR_FETCHING_SESSIONS, handleUserSelect)
			})

			return {
				users,
				totalUsers,
				selectedUser,
			}
		},
	})
</script>

<style scoped>
	.users-list-view {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0;
		box-shadow: 0 0 8px var(--color-shadow);
		padding: 20px;
		width: 100%;
		max-height: 410px;
		overflow-y: auto;
		margin: auto;
	}

	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 10px;
	}

	.header h2 {
		font-size: 1.2em;
		font-weight: bold;
		margin: 0;
		color: var(--color-text);
	}

	.header hr {
		width: 100%;
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 10px 0;
	}

	.users-list {
		display: flex;
		flex-direction: column;
		width: 100%; /* Takes the full width of the parent container */
		gap: 10px;
	}
</style>
