<template>
	<div class="update-information-view">
		<div class="view-header">
			<div class="view-header-left">
				<div class="view-breadcrumb">
					<span>RAMI</span>
					<span class="breadcrumb-sep">/</span>
					<span>PROFIL</span>
					<span class="breadcrumb-sep">/</span>
					<span class="breadcrumb-current">MODIFIER</span>
				</div>
				<h1 class="view-title">MODIFIER MON PROFIL</h1>
				<span class="view-sub">INFORMATIONS & MOT DE PASSE</span>
			</div>
		</div>

		<div class="toggle-container">
			<label class="switch">
				<input
					type="checkbox"
					v-model="changePasswordVisible" />
				<span class="slider round"></span>
			</label>
			<span class="toggle-label">{{ changePasswordVisible ? "Conserver" : "Modifier" }} mon mot de passe</span>
		</div>

		<FormView
			title="Modifier mon profil"
			:formFields="filteredFormFields"
			submitButtonText="Mettre à jour"
			formName="userUpdate"
			sectionText="Retourner au tableau de bord ?"
			sectionLink="/home"
			sectionLinkText="Retour" />
	</div>
</template>

<script lang="ts">
	import { defineComponent, ref, computed } from "vue"
	import { UserFields, Sex } from "#/user"
	import FormView from "@/components/user/Form.vue"
	import FormBuilder from "@/helpers/FormBuilder"

	export default defineComponent({
		name: "UpdateInformationView",
		components: {
			FormView,
		},
		setup() {
			const changePasswordVisible = ref(false)

			const formFields = new FormBuilder()
				.addTextField(UserFields.FIRST_NAME, "Prénom", "Entrez votre prénom", localStorage.getItem(UserFields.FIRST_NAME) || "")
				.addTextField(UserFields.LAST_NAME, "Nom", "Entrez votre nom", localStorage.getItem(UserFields.LAST_NAME) || "")
				.addDateField(UserFields.DATE_OF_BIRTH, "Date de naissance", "Date de naissance", localStorage.getItem(UserFields.DATE_OF_BIRTH) || "", true)
				.addSelectField(
					UserFields.SEX,
					"Sexe",
					[
						{ value: Sex.MALE, label: "Homme" },
						{ value: Sex.FEMALE, label: "Femme" },
						{ value: Sex.OTHER, label: "Autre" },
						{ value: Sex.NOTSPECIFY, label: "Non précisé" },
					],
					localStorage.getItem(UserFields.SEX) || ""
				)
				.addTextField(UserFields.ROLE, "Rôle", "Votre rôle", localStorage.getItem(UserFields.ROLE) || "", true)
				.addTextField(UserFields.EMAIL, "Email", "Entrez votre email", localStorage.getItem(UserFields.EMAIL) || "")
				.addPasswordField(UserFields.PASSWORD, "Mot de passe actuel", "Entrez votre mot de passe actuel")
				.addPasswordField(UserFields.NEW_PASSWORD, "Nouveau mot de passe", "Entrez votre nouveau mot de passe")
				.addPasswordField(UserFields.CONFIRM_NEW_PASSWORD, "Confirmer le mot de passe", "Confirmez votre nouveau mot de passe")
				.build()

			const filteredFormFields = computed(() => {
				if (changePasswordVisible.value) {
					return formFields
				} else {
					return formFields.filter(field => field.name !== UserFields.NEW_PASSWORD && field.name !== UserFields.CONFIRM_NEW_PASSWORD)
				}
			})

			function toggleChangePassword() {
				changePasswordVisible.value = !changePasswordVisible.value
			}

			return {
				formFields,
				filteredFormFields,
				changePasswordVisible,
				toggleChangePassword,
			}
		},
	})
</script>

<style scoped>
	.update-information-view {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.toggle-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding: 0.6rem 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		max-width: 480px;
		width: 100%;
	}

	.toggle-container .switch {
		flex-shrink: 0;
	}

	.toggle-container .toggle-label {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	/* Toggle switch — style phosphore */
	.switch {
		position: relative;
		display: inline-block;
		width: 38px;
		height: 20px;
		flex-shrink: 0;
	}

	.switch input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}

	.slider {
		position: absolute;
		inset: 0;
		background-color: var(--color-border-bright);
		border-radius: 0;
		cursor: pointer;
		transition: background-color 0.2s, box-shadow 0.2s;
		border: 1px solid var(--color-border-bright);
	}

	.slider::before {
		content: "";
		position: absolute;
		width: 14px;
		height: 14px;
		left: 2px;
		top: 2px;
		background: var(--color-text-muted);
		border-radius: 0;
		transition: transform 0.2s, background-color 0.2s;
	}

	input:checked + .slider {
		background-color: var(--color-primary-dim);
		border-color: var(--color-primary);
		box-shadow: 0 0 8px var(--color-primary-glow);
	}

	input:checked + .slider::before {
		transform: translateX(18px);
		background: var(--color-primary);
	}
</style>
