<template>
	<div class="user-form">
		<form @submit.prevent="submitForm">
			<div class="field">
				<label class="field-label">{{ label }}</label>
				<input
					v-model="item"
					class="field-input"
					type="text"
					:placeholder="placeholder" />
			</div>
			<p
				v-if="feedback"
				class="feedback"
				:class="feedbackClass">
				{{ feedback }}
			</p>
			<button
				type="submit"
				class="btn-submit"
				:disabled="!item.trim()">
				Envoyer la demande
			</button>
		</form>
	</div>
</template>

<script lang="ts">
	import { defineComponent, ref } from "vue"
	import useUserSensorOrMeasurementType from "@/composables/useUserSensorOrMeasurementType.composable"

	const LABELS: Record<string, { label: string; placeholder: string }> = {
		"sensor.access": { label: "Nom du capteur", placeholder: "ex: ECG chambre 1" },
		"sensor.request": { label: "Nom du capteur souhaité", placeholder: "ex: Température couloir" },
	}

	export default defineComponent({
		name: "UserForm",
		props: {
			title: { type: String, required: true },
			submitFunction: { type: String, required: true },
		},
		setup(props) {
			const email = localStorage.getItem("email") || ""
			const item = ref("")
			const feedback = ref("")
			const feedbackClass = ref("")

			const meta = LABELS[props.submitFunction] ?? { label: "Valeur", placeholder: "" }

			const submitForm = async () => {
				if (!item.value.trim()) return
				const { error } = await useUserSensorOrMeasurementType().submitForm(email, item.value.trim(), props.submitFunction)
				if (error) {
					feedback.value = error
					feedbackClass.value = "error"
				} else {
					feedback.value = "Demande envoyée avec succès."
					feedbackClass.value = "success"
					item.value = ""
				}
			}

			return { item, feedback, feedbackClass, label: meta.label, placeholder: meta.placeholder, submitForm }
		},
	})
</script>

<style scoped>
	.user-form {
		max-width: 420px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.field-input {
		padding: 8px 12px;
		background: var(--color-surface-secondary);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: 0;
		font-size: 0.9rem;
		width: 100%;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.feedback {
		font-size: 0.85rem;
		margin: 0;
	}

	.feedback.success {
		color: var(--color-success);
	}

	.feedback.error {
		color: var(--color-danger);
	}

	.btn-submit {
		padding: 9px 20px;
		background: var(--color-primary);
		color: var(--color-text-second);
		border: none;
		border-radius: 0;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		width: fit-content;
		transition: background-color 0.15s;
	}

	.btn-submit:hover:not(:disabled) {
		background: var(--color-primary-hover, var(--color-primary));
	}

	.btn-submit:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
