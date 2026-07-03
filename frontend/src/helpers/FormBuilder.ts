interface FormField {
	type: "text" | "password" | "date" | "select" // Correspond to each data types our form is going to deal with
	name: string
	label: string
	placeholder?: string
	options?: { value: string; label: string }[] // For select fields
	value?: string // Optional default value
	readonly?: boolean // Optional readonly attribute
	disabled?: boolean // Optional disabled attribute
}

class FormBuilder {
	private formFields: FormField[]

	constructor() {
		this.formFields = []
	}

	addTextField(name: string, label: string, placeholder: string = "", value: string = "", readonly: boolean = false): FormBuilder {
		this.formFields.push({
			type: "text",
			name,
			label,
			placeholder,
			value,
			readonly,
		})
		return this
	}

	addPasswordField(name: string, label: string, placeholder: string = "", value: string = ""): FormBuilder {
		this.formFields.push({
			type: "password",
			name,
			label,
			placeholder,
			value,
		})
		return this
	}

	addDateField(name: string, label: string, placeholder: string = "", value: string = "", readonly: boolean = false): FormBuilder {
		const formattedValue = value ? this.formatDate(value) : ""
		this.formFields.push({
			type: "date",
			name,
			label,
			placeholder,
			value: formattedValue,
			readonly,
		})
		return this
	}

	addSelectField(name: string, label: string, options: { value: string; label: string }[], value: string = "", disabled: boolean = false): FormBuilder {
		this.formFields.push({
			type: "select",
			name,
			label,
			options,
			value,
			disabled,
		})
		return this
	}

	private formatDate(dateString: string): string {
		const date = new Date(dateString)
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, "0")
		const day = String(date.getDate()).padStart(2, "0")
		return `${year}-${month}-${day}`
	}

	build(): FormField[] {
		return this.formFields
	}
}

export default FormBuilder
export type { FormField }
