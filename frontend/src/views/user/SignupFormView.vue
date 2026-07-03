<template>
	<FormVue
		title="Créer un compte"
		:formFields="formFields"
		submitButtonText="S'inscrire"
		formName="signup"
		sectionLink="/"
		sectionLinkText="Se connecter"
		sectionText="Déjà un compte ?" />
</template>

<script lang="ts">
	import { defineComponent } from "vue"
	import { UserFields, Sex } from "#/user"
	import type { FormField } from "@/helpers/FormBuilder"
	import FormVue from "@/components/user/Form.vue"
	import FormBuilder from "@/helpers/FormBuilder"

	export default defineComponent({
		name: "SignupFormView",
		components: {
			FormVue,
		},
		data() {
			return {
				formFields: [] as FormField[],
			}
		},
		created() {
			this.formFields = new FormBuilder()
				.addTextField(UserFields.FIRST_NAME, "Prénom", "Entrez votre prénom")
				.addTextField(UserFields.LAST_NAME, "Nom", "Entrez votre nom")
				.addDateField(UserFields.DATE_OF_BIRTH, "Date de naissance")
				.addSelectField(UserFields.SEX, "Sexe", [
					{ value: Sex.MALE, label: "Homme" },
					{ value: Sex.FEMALE, label: "Femme" },
					{ value: Sex.OTHER, label: "Autre" },
					{ value: Sex.NOTSPECIFY, label: "Non précisé" },
				])
				.addTextField(UserFields.EMAIL, "Email", "Entrez votre email")
				.addPasswordField(UserFields.PASSWORD, "Mot de passe", "Entrez votre mot de passe")
				.addPasswordField(UserFields.CONFIRM_PASSWORD, "Confirmer le mot de passe", "Confirmez votre mot de passe")
				.build()
		},
	})
</script>

<style scoped>
	/* Add any styles specific to the signup form here */
</style>
