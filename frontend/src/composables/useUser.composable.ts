import { ref } from "vue"
import type { User, UserIsConnected, UserLoginBody, UserMailRole, UserSignup } from "#/user"
import { UserFields, Role, Sex } from "#/user"
import { useAxios } from "@/composables/useAxios.composable"
import type { Error } from "#/error"
import { useMeasurementStore } from "@/stores/measurement"
import { getEventBus, type EventCallback } from "@/helpers/eventBus"

interface loginReturn {
	valid: boolean
	error: Error | null
}

interface SubmitResult {
	valid: boolean
	redirectTo: string | null
}

// État d'erreur réactif partagé, affiché dans les composants au lieu d'utiliser alert()
const submitError = ref<string | null>(null)

/******************************************* ROUTES PATHS & INTERFACE **********************************************/

/**
 * Enum for User Routes Paths (Backend)
 * This enum defines the different API endpoint paths for user-related operations.
 */
enum UserAPIEndpoint {
	LOGIN = "/users/login", //ok
	SIGNUP = "/users/signup", //ok
	UPDATE = "/users/update", //ok
	UPDATE_ROLE = "/users/update/role",
	CHECK_ACCESS_TO_ADMIN_PANEL = "/users/verify/adminPanel", //ok
	GET_ALL_USER = "/users/all", //ok
	USER_SESSIONS = "/users/:id/sessions",
	//DELETE_ACCOUNT = "/user/delete-account",
	//GET_PROFILE = "/user/get-profile",
	// Ajoutez d'autres chemins si nécessaire
}

// *************************** [ATTRIBUTE] DEFINE USER EVENT TYPE (trigger event that others can listen to)
const EventTypes = {
	// for user
	USER_SELECTED_FOR_FETCHING_SESSIONS: "user.fetch.session",
	USER_REQUEST_SESSION_BY_SENSOR: "user.session.on.a.sensor",
	// for sensor
	SENSOR_SELECTED_FOR_FETCHING_SESSIONS: "sensor.fetch.session",
	SENSOR_SELECTED_FOR_CREATING_SESSION: "sensor.create.session",
	// for session
	SESSION_SELECTED: "session.selected",
}

// *************************** [METHOD] DEFINE USER EVENT TYPE (trigger event that others can listen to)

const handleEvent = (action: "on" | "off" | "emit", eventType: (typeof EventTypes)[keyof typeof EventTypes], callbackOrPayload: EventCallback | any) => {
	if (action === "on" || action === "off") {
		const callback = callbackOrPayload as EventCallback
		if (action === "on") {
			getEventBus().on(eventType, callback)
		} else {
			getEventBus().off(eventType, callback)
		}
	} else if (action === "emit") {
		const payload = callbackOrPayload
		getEventBus().emit(eventType, payload)
	}
}

// *************************** [METHOD & MODULE PATTERN]  USER FORM AND CRUD OPERATION FOR USER
/*
	We must check that each field specified by the user is correct. We want to "protect" our backend from invalid requests.
	In other words, let's detect the error as soon as possible 
	=> STRATEGY: we take the errors mentioned by the backend and if we can do the tests in the front, we do it.
	=> EXAMPLE: Check if the name has more than x characters => we can do the check in the frontend.
*/

const validateName = (name: string, fieldName: string, fieldLabel: string, errors: Record<string, string>): boolean => {
	if (!name || typeof name !== "string") {
		errors[fieldName] = `${fieldLabel} is required.`
		return false
	}
	if (name.length < 2) {
		errors[fieldName] = `${fieldLabel} too short. Minimum 2 characters required.`
		return false
	}
	if (name.length > 60) {
		errors[fieldName] = `${fieldLabel} too long. Maximum 60 characters allowed.`
		return false
	}
	return true
}

const validateDateOfBirth = (dateOfBirth: string, fieldName: string, errors: Record<string, string>): boolean => {
	if (!dateOfBirth || isNaN(Date.parse(dateOfBirth))) {
		errors[fieldName] = "Valid date of birth is required."
		return false
	}
	return true
}

const validateSex = (sex: string, fieldName: string, errors: Record<string, string>): boolean => {
	if (!sex || !Object.values(Sex).includes(sex as Sex)) {
		errors[fieldName] = "Valid sex is required."
		return false
	}
	return true
}

const validateEmail = (email: string, fieldName: string, errors: Record<string, string>): boolean => {
	if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
		errors[fieldName] = "Invalid email format."
		return false
	}
	return true
}

const validatePassword = (password: string, fieldName: string, errors: Record<string, string>): boolean => {
	if (password.length == 0) {
		errors[fieldName] = "Password is required."
		return false
	} else if (password.length < 12) {
		errors[fieldName] = "Password too short. Minimum 12 characters required."
		return false
	} else if (password.length > 255) {
		errors[fieldName] = "Password too long. Maximum 255 characters allowed."
		return false
	} else if (!password.match(/[A-Z]/)) {
		errors[fieldName] = "Password must contain at least one uppercase letter."
		return false
	} else if (!password.match(/[a-z]/)) {
		errors[fieldName] = "Password must contain at least one lowercase letter."
		return false
	} else if (!password.match(/[0-9]/)) {
		errors[fieldName] = "Password must contain at least one digit."
		return false
	} else if (!password.match(/[@$!%*?&]/)) {
		errors[fieldName] = "Password must contain at least one special character (@, $, !, %, *, ?, &)."
		return false
	}
	return true
}

const validateConfirmPassword = (password: string, confirmPassword: string, fieldName: string, errors: Record<string, string>): boolean => {
	if (password.length == 0) {
		errors[fieldName] = "Confirm password is required."
		return false
	} else if (password !== confirmPassword) {
		errors[fieldName] = "Passwords do not match."
		return false
	}
	return true
}

const useUser = () => {
	const { axios } = useAxios()

	const login = async (userLoginBody: UserLoginBody) => {
		try {
			// data is the response body from the server to the request post to /user/login with the body userLoginBody ( { email, password } )
			const { data } = (await axios.post<UserIsConnected>(UserAPIEndpoint.LOGIN, { ...userLoginBody })) as { data: UserIsConnected }
			// Set the token, expiresAt, role, id, firstName, lastName, dateOfBirth, and sex in the localStorage
			saveUserDataToLocalStorage(data)
			return { valid: true, error: null }
		} catch (e) {
			const { message, name } = e as { message: string; name: string }
			if (message && name.includes("Axios")) {
				return { valid: false, error: { message } }
			} else {
				const { response } = e as { response: { data: Error } }
				return { valid: false, error: response.data }
			}
		}
	}

	const signup = async (user: UserSignup) => {
		try {
			const { data } = (await axios.post<UserIsConnected>(UserAPIEndpoint.SIGNUP, { ...user })) as { data: UserIsConnected }
			saveUserDataToLocalStorage(data)
			return { valid: true, error: data }
		} catch (e) {
			const { response } = e as { response: { data: Error } }
			return { valid: false, error: response.data }
		}
	}

	const isBetterThan = (role1: Role, role2: Role) => {
		const roles = [Role.ADMIN, Role.PRIVILEGED, Role.REGULAR]
		return roles.indexOf(role1) <= roles.indexOf(role2)
	}

	const canUpdateUserRole = (user: UserMailRole) => {
		const role = localStorage.getItem("role")
		if (role === null) return false
		if (isBetterThan(role as Role, user.role)) {
			return true
		} else {
			return false
		}
	}

	const updateUserInformation = async (userInfo: UserLoginBody) => {
		try {
			const { data } = (await axios.put<UserIsConnected>(UserAPIEndpoint.UPDATE, { ...userInfo })) as unknown as { data: UserIsConnected }
			// Here all happened as planned. So, we can update user all information with those gotten from the form
			cleanUserLocalStorage()
			// Set the token, expiresAt, role, id, firstName, lastName, dateOfBirth, and sex in the localStorage
			saveUserDataToLocalStorage(data)
			return { valid: true, error: null }
		} catch (e) {
			const { response } = e as { response: { data: Error } }
			return { valid: false, error: response.data }
		}
	}

	const updateRole = async (user: UserMailRole) => {
		try {
			const { data } = (await axios.put<UserMailRole>(UserAPIEndpoint.UPDATE_ROLE, { ...user })) as { data: UserMailRole }
			return { valid: true, error: data }
		} catch (e) {
			const { response } = e as { response: { data: Error } }
			return { valid: false, error: response.data }
		}
	}

	const validateForm = (formData: Record<string, any>, formFields: any[], formName: string): { valid: boolean; errors: Record<string, string> } => {
		const errors: Record<string, string> = {}
		let valid = true

		formFields.forEach(field => {
			switch (field.name) {
				case UserFields.FIRST_NAME:
				case UserFields.LAST_NAME:
					if (!validateName(formData[field.name], field.name, field.label, errors)) valid = false
					break
				case UserFields.DATE_OF_BIRTH:
					if (!validateDateOfBirth(formData[field.name], field.name, errors)) valid = false
					break
				case UserFields.SEX:
					if (!validateSex(formData[field.name], field.name, errors)) valid = false
					break
				case UserFields.EMAIL:
					if (!validateEmail(formData[field.name], field.name, errors)) valid = false
					break
				case UserFields.PASSWORD:
					if (formName === "login") {
						if (!formData[field.name]) {
							errors[field.name] = "Password is required."
							valid = false
						}
					} else {
						if (!validatePassword(formData[field.name], field.name, errors)) valid = false
					}
					break
				case UserFields.NEW_PASSWORD:
					if (!validatePassword(formData[field.name], field.name, errors)) valid = false
					break
				case UserFields.CONFIRM_PASSWORD:
					if (!validateConfirmPassword(formData[UserFields.PASSWORD], formData[field.name], field.name, errors)) valid = false
					break
				case UserFields.CONFIRM_NEW_PASSWORD:
					if (!validateConfirmPassword(formData[UserFields.NEW_PASSWORD], formData[field.name], field.name, errors)) valid = false
					break
				default:
					break
			}
		})
		return { valid, errors }
	}

	/**
	 * Saves the user login data to localStorage.
	 *
	 * @param data - The user login data to be saved.
	 */
	const saveUserDataToLocalStorage = (data: UserIsConnected): void => {
		const fieldsToSave: (keyof UserIsConnected)[] = [
			UserFields.TOKEN,
			UserFields.EXPIRES_AT,
			UserFields.ROLE,
			UserFields.ID,
			UserFields.EMAIL,
			UserFields.FIRST_NAME,
			UserFields.LAST_NAME,
			UserFields.DATE_OF_BIRTH,
			UserFields.SEX,
		]

		fieldsToSave.forEach(field => {
			const dataField = data[field]
			if (dataField !== undefined && dataField !== null) {
				localStorage.setItem(field, dataField as string)
			}
		})
	}

	/**
	 * Deletes the user login data from localStorage and clears the refresh token cookie.
	 */
	const cleanUserLocalStorage = async () => {
		const fieldsToRemove: (keyof UserIsConnected)[] = [
			UserFields.TOKEN,
			UserFields.EXPIRES_AT,
			UserFields.ROLE,
			UserFields.ID,
			UserFields.EMAIL,
			UserFields.FIRST_NAME,
			UserFields.LAST_NAME,
			UserFields.DATE_OF_BIRTH,
			UserFields.SEX,
		]

		fieldsToRemove.forEach(field => {
			localStorage.removeItem(field)
		})

		useMeasurementStore().reset()

		// Efface le cookie refreshToken côté serveur
		await axios.post("/auth/logout").catch(() => {})
	}

	const getAllUsers = async () => {
		const result = (await axios.get(UserAPIEndpoint.GET_ALL_USER)) as { data: User[] }
		return result.data
	}

	const canAccessAdminPanel = async () => {
		try {
			const result = await axios.get(UserAPIEndpoint.CHECK_ACCESS_TO_ADMIN_PANEL)
			return { canAccess: true, message: result.data.message }
		} catch (e) {
			const { response } = e as { response: { data: Error } }
			return { canAccess: false, message: response.data.message }
		}
	}

	const errorHandler = (error: Error | null) => {
		if (!error) return
		submitError.value = error.message
	}

	const handleResponse = (response: loginReturn, redirectTo: string): SubmitResult => {
		if (response.valid) {
			submitError.value = null
			return { valid: true, redirectTo } // le composant gère la navigation via router.push
		}
		errorHandler(response.error) // renseigne l'état d'erreur réactif
		return { valid: false, redirectTo: null }
	}

	const submitFormLogin = async (userLoginBody: UserLoginBody): Promise<SubmitResult> => {
		const user = (await login(userLoginBody)) as loginReturn
		return handleResponse(user, "/home")
	}

	const submitFormSignup = async (userLoginBody: UserSignup): Promise<SubmitResult> => {
		const user = (await signup(userLoginBody)) as loginReturn
		return handleResponse(user, "/home")
	}

	const submitFormUserUpdatedInformation = async (userInfo: UserLoginBody): Promise<SubmitResult> => {
		const userUpdated = (await updateUserInformation(userInfo)) as loginReturn
		return handleResponse(userUpdated, "/home")
	}

	const submitForm = async (userFormBody: unknown, formName: string): Promise<SubmitResult> => {
		submitError.value = null
		switch (formName) {
			case "login":
				return submitFormLogin(userFormBody as unknown as UserLoginBody)
			case "signup":
				return submitFormSignup(userFormBody as unknown as UserSignup)
			case "userUpdate":
				return submitFormUserUpdatedInformation(userFormBody as unknown as UserLoginBody)
			default:
				submitError.value = "Invalid form name"
				return { valid: false, redirectTo: null }
		}
	}

	return {
		login,
		signup,
		canUpdateUserRole,
		cleanUserLocalStorage,
		getAllUsers,
		updateRole,
		canAccessAdminPanel,
		validateForm,
		submitForm,
		submitError,
	}
}

export { useUser, UserFields, Role, Sex, EventTypes, handleEvent }
export type { loginReturn }
