<template>
	<div class="form-outer">
		<div class="form-container">
			<!-- Coin décoratif -->
			<div class="corner corner-tl" />
			<div class="corner corner-tr" />
			<div class="corner corner-bl" />
			<div class="corner corner-br" />

			<div class="form-inner">
				<h1 class="form-title">{{ title }}</h1>
				<p class="form-subtitle">SYSTÈME DE SURVEILLANCE IOT — UMONS</p>

				<form @submit.prevent="handleSubmit">
					<div
						class="input-row"
						v-for="(field, index) in formFields"
						:key="index">
						<label
							:for="field.name"
							class="form-label">
							<span class="label-num">{{ String(index + 1).padStart(2, "0") }}</span>
							{{ field.label }}
						</label>

						<div class="input-field">
							<input
								v-if="isInputField(field.type)"
								v-model="formData[field.name]"
								:name="field.name"
								:type="field.type"
								:id="field.name"
								:placeholder="field.placeholder"
								:readonly="field.readonly"
								class="form-input" />
							<select
								v-if="field.type === 'select'"
								v-model="formData[field.name]"
								:name="field.name"
								:id="field.name"
								class="form-input">
								<option
									v-for="option in field.options"
									:value="option.value"
									:key="option.value">
									{{ option.label }}
								</option>
							</select>
						</div>

						<div
							v-if="errors[field.name]"
							class="error-message">
							<span class="error-icon">▲</span>
							{{ errors[field.name] }}
						</div>
						<div
							v-if="field.readonly"
							class="readonly-message">
							CHAMP NON MODIFIABLE
						</div>
					</div>

					<div
						v-if="submitError"
						class="error-message form-error">
						<span class="error-icon">▲</span>
						{{ submitError }}
					</div>

					<div class="input-row submit-row">
						<button
							type="submit"
							class="submit-button">
							<span class="btn-arrow">▶</span>
							{{ submitButtonText }}
						</button>
					</div>
				</form>

				<div class="form-section">
					<span class="section-text">{{ sectionText }}</span>
					<router-link
						:to="sectionLink"
						class="section-link">
						{{ sectionLinkText }} →
					</router-link>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
	import { defineComponent } from "vue"
	import { useUser } from "@/composables/useUser.composable"
	import type { FormField } from "@/helpers/FormBuilder"

	const { submitError } = useUser()

	export default defineComponent({
		name: "FormView",
		props: {
			title: { type: String, required: true },
			formFields: { type: Array as () => FormField[], required: true },
			submitButtonText: { type: String, required: true },
			formName: { type: String, required: true },
			sectionText: { type: String, required: true },
			sectionLink: { type: String, required: true },
			sectionLinkText: { type: String, required: true },
		},
		data() {
			return {
				formData: {} as Record<string, string>,
				errors: {} as Record<string, string>,
				submitError,
			}
		},
		created() {
			this.formFields.forEach(field => {
				this.formData[field.name] = field.value || ""
			})
		},
		methods: {
			async handleSubmit() {
				const { validateForm, submitForm } = useUser()
				this.errors = {}

				const userFormValidity = validateForm(this.formData, this.formFields, this.formName)

				if (!userFormValidity.valid) {
					this.errors = userFormValidity.errors
					return
				}

				const result = await submitForm(this.formData, this.formName)
				if (result.valid && result.redirectTo) {
					this.$router.push(result.redirectTo)
				}
			},
			isInputField(type: string): type is "text" | "password" | "date" | "email" {
				return ["text", "password", "date", "email"].includes(type)
			},
		},
	})
</script>

<style scoped>
	.form-outer {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 70vh;
		padding: 2rem 1rem;
	}

	.form-container {
		width: 100%;
		max-width: 480px;
		background: var(--color-surface);
		border: 1px solid var(--color-border-bright);
		padding: 2px;
		position: relative;
		box-shadow: 0 0 60px var(--color-primary-glow), 0 0 120px rgba(255, 159, 10, 0.04);
	}

	/* Coins décoratifs */
	.corner {
		position: absolute;
		width: 12px;
		height: 12px;
		border-color: var(--color-primary);
		border-style: solid;
		z-index: 1;
	}
	.corner-tl {
		top: -1px;
		left: -1px;
		border-width: 2px 0 0 2px;
	}
	.corner-tr {
		top: -1px;
		right: -1px;
		border-width: 2px 2px 0 0;
	}
	.corner-bl {
		bottom: -1px;
		left: -1px;
		border-width: 0 0 2px 2px;
	}
	.corner-br {
		bottom: -1px;
		right: -1px;
		border-width: 0 2px 2px 0;
	}

	.form-inner {
		padding: 2.5rem 2rem 2rem;
	}

	.form-title {
		font-family: var(--font-display);
		font-size: 2.8rem;
		font-weight: 900;
		color: var(--color-primary);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1;
		text-shadow: 0 0 30px var(--color-primary-glow), 0 0 60px rgba(255, 159, 10, 0.15);
		margin-bottom: 4px;
		animation: title-fade-in 0.4s ease-out both;
	}

	@keyframes title-fade-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.form-subtitle {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-text-muted);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		font-weight: 300;
		margin-bottom: 2.5rem;
		opacity: 0.7;
	}

	.input-row {
		margin-bottom: 1.5rem;
	}

	.submit-row {
		margin-top: 2rem;
		margin-bottom: 0;
	}

	.form-label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 6px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		font-weight: 400;
	}

	.label-num {
		color: var(--color-primary);
		opacity: 0.5;
		font-weight: 700;
		font-size: 0.65rem;
	}

	.input-field {
		position: relative;
	}

	.form-input {
		width: 100%;
		padding: 0.7rem 0.9rem;
		font-size: 0.85rem;
		border: 1px solid var(--color-border-bright);
		background: var(--color-overlay);
		color: var(--color-text);
		font-family: var(--font-mono);
		border-radius: 0;
		transition: border-color 0.2s, box-shadow 0.2s;
		outline: none;
	}

	.form-input::placeholder {
		color: var(--color-text-muted);
		font-size: 0.78rem;
	}

	.form-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-primary-glow), 0 0 16px var(--color-primary-dim);
	}

	.form-input[readonly] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		margin-top: 5px;
		color: var(--color-danger);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.error-icon {
		font-size: 0.6rem;
	}

	.form-error {
		margin: 0.75rem 0 0.25rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-danger);
		background: var(--color-overlay);
		font-size: 0.72rem;
	}

	.readonly-message {
		margin-top: 4px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.submit-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.85rem 1.5rem;
		font-size: 0.82rem;
		font-family: var(--font-mono);
		font-weight: 700;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--color-text-second);
		background: var(--color-primary);
		border: none;
		cursor: pointer;
		transition: background-color 0.2s, box-shadow 0.2s, transform 0.1s;
		border-radius: 0;
		position: relative;
		overflow: hidden;
	}

	.submit-button::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.15) 50%, transparent 60%);
		transform: translateX(-100%);
		transition: transform 0.35s ease;
	}

	.submit-button:hover::after {
		transform: translateX(100%);
	}

	.submit-button:hover {
		background: var(--color-primary-hover);
		box-shadow: 0 0 30px var(--color-primary-glow);
		color: var(--color-text-second);
	}

	.submit-button:active {
		transform: scaleX(0.98);
	}

	.btn-arrow {
		font-size: 0.65rem;
		opacity: 0.7;
	}

	/* Lien bas de formulaire */
	.form-section {
		margin-top: 1.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.section-text {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-text-muted);
		letter-spacing: 0.04em;
	}

	.section-link {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-primary);
		letter-spacing: 0.04em;
		text-decoration: none;
		transition: opacity 0.15s;
	}

	.section-link:hover {
		opacity: 0.75;
	}
</style>
