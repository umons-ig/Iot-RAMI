import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { setActivePinia, createPinia } from "pinia"

// Mock des dépendances externes
vi.mock("@/composables/useAxios.composable", () => ({
	useAxios: () => ({ axios: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }),
}))

vi.mock("@/stores/measurement", () => ({
	useMeasurementStore: () => ({ reset: vi.fn() }),
}))

vi.mock("@/helpers/eventBus", () => ({
	getEventBus: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() }),
}))

import { useUser, Role } from "@/composables/useUser.composable"
import { UserFields } from "#/user"

describe("useUser — validateForm", () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	const { validateForm } = useUser()

	// Champs de base pour le formulaire signup
	const signupFields = [
		{ name: UserFields.FIRST_NAME, label: "First Name" },
		{ name: UserFields.LAST_NAME, label: "Last Name" },
		{ name: UserFields.DATE_OF_BIRTH, label: "Date of Birth" },
		{ name: UserFields.SEX, label: "Sex" },
		{ name: UserFields.EMAIL, label: "Email" },
		{ name: UserFields.PASSWORD, label: "Password" },
		{ name: UserFields.CONFIRM_PASSWORD, label: "Confirm Password" },
	]

	const loginFields = [
		{ name: UserFields.EMAIL, label: "Email" },
		{ name: UserFields.PASSWORD, label: "Password" },
	]

	const validSignupData = {
		[UserFields.FIRST_NAME]: "John",
		[UserFields.LAST_NAME]: "Doe",
		[UserFields.DATE_OF_BIRTH]: "1990-01-01",
		[UserFields.SEX]: "male",
		[UserFields.EMAIL]: "john@example.com",
		[UserFields.PASSWORD]: "SecurePass1!",
		[UserFields.CONFIRM_PASSWORD]: "SecurePass1!",
	}

	describe("signup form", () => {
		it("should return valid=true for correct signup data", () => {
			const result = validateForm(validSignupData, signupFields, "signup")
			expect(result.valid).toBe(true)
			expect(result.errors).toEqual({})
		})

		describe("firstName validation", () => {
			it("should fail if firstName is empty", () => {
				const data = { ...validSignupData, [UserFields.FIRST_NAME]: "" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.FIRST_NAME]).toBeTruthy()
			})

			it("should fail if firstName is too short (< 2 chars)", () => {
				const data = { ...validSignupData, [UserFields.FIRST_NAME]: "A" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.FIRST_NAME]).toMatch(/short/)
			})

			it("should fail if firstName is too long (> 60 chars)", () => {
				const data = { ...validSignupData, [UserFields.FIRST_NAME]: "A".repeat(61) }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.FIRST_NAME]).toMatch(/long/)
			})
		})

		describe("email validation", () => {
			it("should fail for invalid email format", () => {
				const data = { ...validSignupData, [UserFields.EMAIL]: "not-an-email" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.EMAIL]).toMatch(/email/i)
			})

			it("should pass for valid email", () => {
				const data = { ...validSignupData, [UserFields.EMAIL]: "test@umons.ac.be" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.errors[UserFields.EMAIL]).toBeUndefined()
			})
		})

		describe("password validation", () => {
			it("should fail if password is too short (< 12 chars)", () => {
				const data = { ...validSignupData, [UserFields.PASSWORD]: "Short1!", [UserFields.CONFIRM_PASSWORD]: "Short1!" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.PASSWORD]).toMatch(/short/i)
			})

			it("should fail if password has no uppercase", () => {
				const data = { ...validSignupData, [UserFields.PASSWORD]: "nouppercase1!", [UserFields.CONFIRM_PASSWORD]: "nouppercase1!" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.PASSWORD]).toMatch(/uppercase/i)
			})

			it("should fail if password has no digit", () => {
				const data = { ...validSignupData, [UserFields.PASSWORD]: "NoDigitAtAll!", [UserFields.CONFIRM_PASSWORD]: "NoDigitAtAll!" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.PASSWORD]).toMatch(/digit/i)
			})

			it("should fail if password has no special character", () => {
				const data = { ...validSignupData, [UserFields.PASSWORD]: "NoSpecialChar1", [UserFields.CONFIRM_PASSWORD]: "NoSpecialChar1" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.PASSWORD]).toMatch(/special/i)
			})
		})

		describe("confirmPassword validation", () => {
			it("should fail if passwords do not match", () => {
				const data = { ...validSignupData, [UserFields.CONFIRM_PASSWORD]: "DifferentPass1!" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.CONFIRM_PASSWORD]).toMatch(/match/i)
			})
		})

		describe("dateOfBirth validation", () => {
			it("should fail for invalid date", () => {
				const data = { ...validSignupData, [UserFields.DATE_OF_BIRTH]: "not-a-date" }
				const result = validateForm(data, signupFields, "signup")
				expect(result.valid).toBe(false)
				expect(result.errors[UserFields.DATE_OF_BIRTH]).toBeTruthy()
			})
		})
	})

	describe("login form", () => {
		it("should return valid=true with email and non-empty password", () => {
			const data = {
				[UserFields.EMAIL]: "john@example.com",
				[UserFields.PASSWORD]: "anypassword",
			}
			const result = validateForm(data, loginFields, "login")
			expect(result.valid).toBe(true)
		})

		it("should fail if password is empty on login", () => {
			const data = {
				[UserFields.EMAIL]: "john@example.com",
				[UserFields.PASSWORD]: "",
			}
			const result = validateForm(data, loginFields, "login")
			expect(result.valid).toBe(false)
			expect(result.errors[UserFields.PASSWORD]).toMatch(/required/i)
		})

		it("should not enforce password complexity on login", () => {
			// Login accepte n'importe quel mot de passe non vide
			const data = {
				[UserFields.EMAIL]: "john@example.com",
				[UserFields.PASSWORD]: "simple",
			}
			const result = validateForm(data, loginFields, "login")
			expect(result.valid).toBe(true)
		})
	})
})

describe("useUser — isBetterThan (via canUpdateUserRole)", () => {
	const getItemMock = vi.fn()

	beforeAll(() => {
		Object.defineProperty(window, "localStorage", {
			value: { getItem: getItemMock, setItem: vi.fn(), removeItem: vi.fn() },
			writable: true,
		})
	})

	beforeEach(() => {
		setActivePinia(createPinia())
		getItemMock.mockReset()
	})

	it("should not allow update if role is not in localStorage", () => {
		getItemMock.mockReturnValue(null)
		const { canUpdateUserRole } = useUser()
		const result = canUpdateUserRole({ email: "x@x.com", role: Role.REGULAR })
		expect(result).toBe(false)
	})

	it("should allow admin to update a regular user", () => {
		getItemMock.mockReturnValue(Role.ADMIN)
		const { canUpdateUserRole } = useUser()
		const result = canUpdateUserRole({ email: "x@x.com", role: Role.REGULAR })
		expect(result).toBe(true)
	})

	it("should not allow regular user to update an admin", () => {
		getItemMock.mockReturnValue(Role.REGULAR)
		const { canUpdateUserRole } = useUser()
		const result = canUpdateUserRole({ email: "x@x.com", role: Role.ADMIN })
		expect(result).toBe(false)
	})
})
