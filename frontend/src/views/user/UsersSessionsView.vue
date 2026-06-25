<template>
	<div class="users-sessions-view">
		<div class="view-header">
			<div class="view-header-left">
				<div class="view-breadcrumb">
					<span>RAMI</span>
					<span class="breadcrumb-sep">/</span>
					<span class="breadcrumb-current">UTILISATEURS</span>
				</div>
				<h1 class="view-title">UTILISATEURS & SESSIONS</h1>
				<span class="view-sub">SESSIONS PAR UTILISATEUR</span>
			</div>
		</div>
		<div class="users-list-container">
			<UsersList />
		</div>
		<div class="sessions-list-container">
			<SessionList />
		</div>
	</div>
</template>

<script lang="ts">
	import { defineComponent } from "vue"
	import UsersList from "@/components/user/UsersList.vue"
	import SessionList from "@/components/session/SessionsList.vue"

	export default defineComponent({
		name: "UsersSessionsView",
		components: {
			UsersList,
			SessionList,
		},
	})
</script>

<style scoped>
	.users-sessions-view {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: 100%;
	}

	.users-list-container {
		width: 100%;
	}

	.sessions-list-container {
		width: 100%;
	}
</style>
