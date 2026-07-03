import { describe, it, expect, beforeEach } from "vitest"
import FormBuilder from "@/helpers/FormBuilder"

describe("FormBuilder", () => {
	let builder: FormBuilder

	beforeEach(() => {
		builder = new FormBuilder()
	})

	describe("build()", () => {
		it("should return an empty array when no fields are added", () => {
			expect(builder.build()).toEqual([])
		})
	})

	describe("addTextField()", () => {
		it("should add a text field with required params", () => {
			const fields = builder.addTextField("username", "Username").build()
			expect(fields).toHaveLength(1)
			expect(fields[0]).toMatchObject({ type: "text", name: "username", label: "Username" })
		})

		it("should add a text field with placeholder and value", () => {
			const fields = builder.addTextField("username", "Username", "Enter username", "john").build()
			expect(fields[0].placeholder).toBe("Enter username")
			expect(fields[0].value).toBe("john")
		})

		it("should support readonly attribute", () => {
			const fields = builder.addTextField("username", "Username", "", "", true).build()
			expect(fields[0].readonly).toBe(true)
		})

		it("should support method chaining", () => {
			const fields = builder.addTextField("first", "First").addTextField("second", "Second").build()
			expect(fields).toHaveLength(2)
		})
	})

	describe("addPasswordField()", () => {
		it("should add a password field", () => {
			const fields = builder.addPasswordField("password", "Password").build()
			expect(fields[0]).toMatchObject({ type: "password", name: "password", label: "Password" })
		})

		it("should have empty placeholder and value by default", () => {
			const fields = builder.addPasswordField("password", "Password").build()
			expect(fields[0].placeholder).toBe("")
			expect(fields[0].value).toBe("")
		})
	})

	describe("addDateField()", () => {
		it("should add a date field", () => {
			const fields = builder.addDateField("dob", "Date of Birth").build()
			expect(fields[0]).toMatchObject({ type: "date", name: "dob", label: "Date of Birth" })
		})

		it("should format the date value to YYYY-MM-DD", () => {
			const fields = builder.addDateField("dob", "Date of Birth", "", "2000-06-15T00:00:00").build()
			expect(fields[0].value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
		})

		it("should keep empty value if no date is provided", () => {
			const fields = builder.addDateField("dob", "Date of Birth").build()
			expect(fields[0].value).toBe("")
		})
	})

	describe("addSelectField()", () => {
		const options = [
			{ value: "male", label: "Male" },
			{ value: "female", label: "Female" },
		]

		it("should add a select field", () => {
			const fields = builder.addSelectField("sex", "Sex", options).build()
			expect(fields[0]).toMatchObject({ type: "select", name: "sex", label: "Sex" })
		})

		it("should store the options", () => {
			const fields = builder.addSelectField("sex", "Sex", options).build()
			expect(fields[0].options).toEqual(options)
		})

		it("should support disabled attribute", () => {
			const fields = builder.addSelectField("sex", "Sex", options, "", true).build()
			expect(fields[0].disabled).toBe(true)
		})
	})

	describe("chaining multiple field types", () => {
		it("should build a form with mixed field types", () => {
			const fields = builder
				.addTextField("firstName", "First Name")
				.addPasswordField("password", "Password")
				.addDateField("dob", "Date of Birth")
				.addSelectField("sex", "Sex", [{ value: "M", label: "Male" }])
				.build()
			expect(fields).toHaveLength(4)
			expect(fields.map(f => f.type)).toEqual(["text", "password", "date", "select"])
		})
	})
})
