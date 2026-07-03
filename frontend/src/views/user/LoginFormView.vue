<template>
	<div>
		<FormVue
			title="Connexion"
			:formFields="formFields"
			submitButtonText="Se connecter"
			formName="login"
			sectionLink="/signup"
			sectionLinkText="Créer un compte"
			sectionText="Pas encore de compte ?" />
	</div>
</template>

<script lang="ts">
	import { defineComponent } from "vue"
	import { UserFields } from "#/user"
	import type { FormField } from "@/helpers/FormBuilder"
	import FormVue from "@/components/user/Form.vue"
	import FormBuilder from "@/helpers/FormBuilder"

	export default defineComponent({
		name: "LoginFormView",
		components: {
			FormVue,
		},
		data() {
			return {
				formFields: [] as FormField[],
			}
		},
		created() {
			this.formFields = new FormBuilder().addTextField(UserFields.EMAIL, "Email", "Entrez votre email").addPasswordField(UserFields.PASSWORD, "Mot de passe", "Entrez votre mot de passe").build()
		},
	})
</script>

<style scoped>
	/* Add any styles specific to the login form here */
</style>
