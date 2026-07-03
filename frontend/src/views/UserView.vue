<template>
	<div class="user-view">
		<div class="view-header">
			<div class="view-header-left">
				<div class="view-breadcrumb">
					<span>RAMI</span>
					<span class="breadcrumb-sep">/</span>
					<span class="breadcrumb-current">PROFIL</span>
				</div>
				<h1 class="view-title">MON PROFIL</h1>
				<span class="view-sub">COMPTE & DEMANDES D'ACCÈS</span>
			</div>
		</div>

		<!-- Profile card -->
		<div class="profile-card">
			<div class="profile-avatar">
				{{ initials }}
			</div>
			<div class="profile-info">
				<h1 class="profile-name">{{ firstName }} {{ lastName }}</h1>
				<p class="profile-email">{{ email }}</p>
				<span class="profile-role-badge">{{ role }}</span>
			</div>
			<router-link
				to="/user/update"
				class="btn-edit">
				Modifier le profil
			</router-link>
		</div>

		<!-- Requests section -->
		<div class="requests-section">
			<h2 class="section-title">Mes demandes</h2>
			<div class="tabs">
				<button
					v-for="tab in tabs"
					:key="tab.name"
					class="tab-btn"
					:class="{ active: selectedTab === tab.name }"
					@click="selectedTab = tab.name">
					{{ tab.label }}
				</button>
			</div>
			<div class="tab-content">
				<component :is="selectedTab" />
			</div>
		</div>
	</div>
</template>

<script lang="ts">
	import { defineComponent, ref, computed } from "vue"
	import { UserFields } from "@/composables/useUser.composable"
	import UserSensorAccess from "@/components/user/UserSensorAccess.vue"

	export default defineComponent({
		name: "UserView",
		components: { UserSensorAccess },
		setup() {
			const firstName = localStorage.getItem(UserFields.FIRST_NAME) || ""
			const lastName = localStorage.getItem(UserFields.LAST_NAME) || ""
			const email = localStorage.getItem(UserFields.EMAIL) || ""
			const role = localStorage.getItem(UserFields.ROLE) || "n/a"

			const initials = computed(() => {
				const f = firstName.charAt(0).toUpperCase()
				const l = lastName.charAt(0).toUpperCase()
				return f + l || "?"
			})

			const tabs = [{ name: "UserSensorAccess", label: "Accès capteur" }]
			const selectedTab = ref("UserSensorAccess")

			return { firstName, lastName, email, role, initials, tabs, selectedTab }
		},
	})
</script>

<style scoped>
	.user-view {
		padding: 2rem;
		max-width: 860px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* Profile card */
	.profile-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0;
		padding: 1.75rem 2rem;
		box-shadow: inset 0 0 8px var(--color-overlay);
		transition: box-shadow 0.2s, border-color 0.2s;
	}

	.profile-card:hover {
		border-color: var(--color-border-bright);
		box-shadow: inset 0 0 30px var(--color-overlay), 0 0 20px var(--color-primary-dim);
	}

	.profile-avatar {
		width: 80px;
		height: 80px;
		border-radius: 0;
		background: var(--color-surface-secondary);
		border: 2px solid var(--color-primary);
		box-shadow: 0 0 12px var(--color-primary-glow), inset 0 0 20px var(--color-overlay);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 900;
		color: var(--color-primary);
		text-shadow: 0 0 16px var(--color-primary);
		flex-shrink: 0;
	}

	.profile-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.profile-name {
		font-size: 1.3rem;
		font-weight: 700;
		margin: 0;
		color: var(--color-text);
		text-shadow: 0 0 20px var(--color-primary-dim);
	}

	.profile-email {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-role-badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 2px 10px;
		border-radius: 0;
		background: var(--color-info-dim);
		border: 1px solid var(--color-info);
		color: var(--color-primary);
		width: fit-content;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: var(--font-mono);
	}

	.btn-edit {
		padding: 8px 18px;
		background: var(--color-surface-secondary);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		flex-shrink: 0;
		transition: background-color 0.15s, border-color 0.15s;
	}

	.btn-edit:hover {
		background: var(--color-primary);
		color: var(--color-text-second);
		border-color: var(--color-primary);
		box-shadow: 0 0 12px var(--color-primary-glow);
	}

	/* Requests section */
	.requests-section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0;
		padding: 1.5rem 2rem;
		box-shadow: inset 0 0 8px var(--color-overlay);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
		color: var(--color-text);
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tab-btn {
		padding: 6px 16px;
		font-size: 0.85rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		border-radius: 0;
		background: var(--color-surface-secondary);
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		transition: background-color 0.15s, color 0.15s, border-color 0.15s, text-shadow 0.15s;
	}

	.tab-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.tab-btn.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-text-second);
		text-shadow: 0 0 8px var(--color-primary-dim);
	}

	.tab-content {
		padding-top: 0.5rem;
	}

	/* Mobile */
	@media (max-width: 600px) {
		.user-view {
			padding: 1rem;
		}

		.profile-card {
			flex-direction: column;
			align-items: flex-start;
			padding: 1.25rem;
		}

		.btn-edit {
			width: 100%;
			text-align: center;
		}

		.requests-section {
			padding: 1.25rem;
		}
	}
</style>
