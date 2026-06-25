<script lang="ts">
	import { defineComponent, ref } from "vue"
	import AdminRoleComponent from "@/components/AdminRole.vue"
	import AdminSensorAccess from "@/components/AdminSensorAccess.vue"
	import AdminActiveSessions from "@/components/AdminActiveSessions.vue"
	import AdminDiscoveredSensors from "@/components/AdminDiscoveredSensors.vue"
	import AdminDiscoveredMeasurementTypes from "@/components/AdminDiscoveredMeasurementTypes.vue"
	import AdminSensorsList from "@/components/AdminSensorsList.vue"
	import AdminMeasurementTypesList from "@/components/AdminMeasurementTypesList.vue"

	const tabs = [
		{ key: "roles", label: "Rôles" },
		{ key: "access", label: "Accès" },
		{ key: "sessions", label: "Sessions" },
		{ key: "sensors", label: "Capteurs" },
		{ key: "measure-types", label: "Types de mesures" },
	] as const

	type TabKey = (typeof tabs)[number]["key"]

	export default defineComponent({
		name: "AdminView",
		components: {
			AdminRoleComponent,
			AdminSensorAccess,
			AdminActiveSessions,
			AdminDiscoveredSensors,
			AdminDiscoveredMeasurementTypes,
			AdminSensorsList,
			AdminMeasurementTypesList,
		},
		setup() {
			const activeTab = ref<TabKey>("roles")
			return { tabs, activeTab }
		},
	})
</script>

<template>
	<div class="admin">
		<!-- Titre -->
		<div class="admin-title-block">
			<div class="view-breadcrumb">
				<span>RAMI</span>
				<span class="breadcrumb-sep">/</span>
				<span class="breadcrumb-current">ADMIN</span>
			</div>
			<h1>ADMINISTRATION</h1>
			<span class="admin-sub">PANNEAU DE CONTRÔLE SYSTÈME</span>
		</div>

		<!-- Tabs -->
		<div class="tabs-bar">
			<button
				v-for="tab in tabs"
				:key="tab.key"
				class="tab-btn"
				:class="{ active: activeTab === tab.key }"
				@click="activeTab = tab.key">
				{{ tab.label }}
			</button>
		</div>

		<!-- Contenu -->
		<div class="tab-content">
			<AdminRoleComponent v-show="activeTab === 'roles'" />
			<AdminSensorAccess v-show="activeTab === 'access'" />
			<AdminActiveSessions v-show="activeTab === 'sessions'" />
			<div v-show="activeTab === 'sensors'">
				<AdminSensorsList />
				<div class="section-divider">
					<span>DÉCOUVERTE AUTOMATIQUE</span>
				</div>
				<AdminDiscoveredSensors />
			</div>
			<div v-show="activeTab === 'measure-types'">
				<AdminMeasurementTypesList />
				<div class="section-divider">
					<span>TYPES DÉCOUVERTS</span>
				</div>
				<AdminDiscoveredMeasurementTypes />
			</div>
		</div>
	</div>
</template>

<style scoped>
	.admin {
		width: 100%;
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Titre */
	.admin-title-block {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.admin-title-block h1 {
		font-family: var(--font-display);
		font-size: 2.4rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		line-height: 1;
		color: var(--color-text);
	}

	.admin-sub {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		display: block;
		margin-top: 4px;
	}

	/* Tabs */
	.tabs-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		border-bottom: 1px solid var(--color-border);
	}

	.tab-btn {
		padding: 0.65rem 1.1rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 400;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: transparent;
		color: var(--color-text-muted);
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s, border-color 0.15s;
		border-radius: 0;
	}

	.tab-btn:hover {
		color: var(--color-text);
		background: var(--color-primary-dim);
		border-color: transparent;
	}

	.tab-btn.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
		background: var(--color-primary-dim);
	}

	/* Contenu */
	.tab-content {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		padding: 1.5rem 1.75rem;
		min-height: calc(100vh - 280px);
	}

	/* Séparateur de sections dans un même tab */
	.section-divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 2rem 0 1.5rem;
	}

	.section-divider::before,
	.section-divider::after {
		content: "";
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.section-divider span {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	/* Styles globaux pour les sous-composants admin */
	.tab-content :deep(h1),
	.tab-content :deep(h2) {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 900;
		margin: 0 0 1.25rem;
		color: var(--color-text-muted);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.tab-content :deep(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
		font-family: var(--font-mono);
	}

	.tab-content :deep(thead tr) {
		background: var(--color-surface-secondary);
	}

	.tab-content :deep(th) {
		padding: 0.65rem 0.9rem;
		text-align: left;
		font-weight: 700;
		font-size: 0.65rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
	}

	.tab-content :deep(th:hover) {
		color: var(--color-primary);
	}

	.tab-content :deep(td) {
		padding: 0.65rem 0.9rem;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text);
		vertical-align: middle;
	}

	.tab-content :deep(tbody tr:hover) {
		background: var(--color-primary-dim);
	}

	.tab-content :deep(select) {
		background: var(--color-surface-secondary);
		color: var(--color-text);
		border: 1px solid var(--color-border-bright);
		padding: 0.4rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		margin-bottom: 1rem;
		cursor: pointer;
		border-radius: 0;
		outline: none;
	}

	.tab-content :deep(select:focus) {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-primary-glow);
	}

	.tab-content :deep(label) {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	/* Boutons dans les tableaux */
	.tab-content :deep(td button) {
		padding: 3px 10px;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: 1px solid var(--color-success-dim);
		border-radius: 0;
		cursor: pointer;
		transition: all 0.15s;
		background: var(--color-success-dim);
		color: var(--color-success);
	}

	.tab-content :deep(td button:hover) {
		background: var(--color-success);
		color: var(--color-text-second);
		border-color: var(--color-success);
	}

	.tab-content :deep(td button.btn-danger) {
		background: var(--color-danger-dim);
		color: var(--color-danger);
		border-color: var(--color-danger-dim);
	}

	.tab-content :deep(td button.btn-danger:hover) {
		background: var(--color-danger);
		color: var(--color-text-second);
		border-color: var(--color-danger);
	}

	/* Formulaire admin */
	.tab-content :deep(form) {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 400px;
	}

	.tab-content :deep(form label) {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
	}

	.tab-content :deep(form select) {
		width: 100%;
		margin-bottom: 0;
	}

	.tab-content :deep(form button[type="submit"]) {
		padding: 0.6rem 1.25rem;
		background: var(--color-primary);
		color: var(--color-text-second);
		border: none;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		align-self: flex-start;
		transition: all 0.15s;
		border-radius: 0;
	}

	.tab-content :deep(form button[type="submit"]:hover) {
		background: var(--color-primary-hover);
		box-shadow: 0 0 16px var(--color-primary-glow);
	}
</style>
