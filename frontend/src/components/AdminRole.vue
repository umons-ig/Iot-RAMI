<template>
	<div class="admin-role">
		<p class="description">MODIFIER LE RÔLE D'UN UTILISATEUR</p>
		<form
			class="role-form"
			@submit.prevent="submitUpdateUserRole">
			<label>
				Utilisateur
				<select v-model="userSelected">
					<option
						value=""
						disabled>
						Sélectionner un utilisateur
					</option>
					<option
						v-for="user in users"
						:key="user.email"
						:value="user.email">
						{{ user.email }} — {{ user.role }}
					</option>
				</select>
			</label>
			<label>
				Nouveau rôle
				<select v-model="roleSelected">
					<option
						value=""
						disabled>
						Sélectionner un rôle
					</option>
					<option
						v-for="role in roles"
						:key="role"
						:value="role">
						{{ role }}
					</option>
				</select>
			</label>
			<div
				v-if="errorMsg"
				class="inline-error">
				{{ errorMsg }}
			</div>
			<button
				type="submit"
				:disabled="!userSelected || !roleSelected">
				METTRE À JOUR
			</button>
		</form>
	</div>
</template>

<script lang="ts">
	import { defineComponent } from "vue"
	import type { User } from "#/user"
	import { Role, useUser } from "@/composables/useUser.composable"

	export interface AdminRoleData {
		users: User[]
		userSelected: string
		roles: Role[]
		roleSelected: string
		errorMsg: string
	}

	export default defineComponent({
		name: "AdminRoleComponent",
		data(): AdminRoleData {
			return {
				users: [],
				userSelected: "",
				roles: [Role.REGULAR, Role.PRIVILEGED, Role.ADMIN],
				roleSelected: "",
				errorMsg: "",
			}
		},
		methods: {
			async submitUpdateUserRole(e: Event) {
				e.preventDefault()
				this.errorMsg = ""
				const email = this.userSelected
				const role = this.roleSelected as Role
				if (!useUser().canUpdateUserRole({ email: email, role: role })) {
					this.errorMsg = "ACCÈS REFUSÉ : opération non autorisée."
					return
				} else {
					const result = await useUser().updateRole({ email: email, role: role })
					if (result.valid) {
						await this.refreshUsers()
					} else {
						this.errorMsg = "ERREUR : impossible de mettre à jour le rôle."
					}
				}
			},
			async refreshUsers() {
				const result = await useUser().getAllUsers()
				if (result) {
					this.users = result
				} else {
					console.error("Error while fetching users")
				}
			},
		},
		async mounted() {
			await this.refreshUsers()
		},
	})
</script>

<style scoped>
	.admin-role {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}

	.description {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.12em;
		color: var(--color-text-muted);
		margin: 0;
	}

	.role-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 480px;
	}

	.inline-error {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		color: var(--color-danger);
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-danger-dim);
		background: var(--color-danger-dim);
	}
</style>
