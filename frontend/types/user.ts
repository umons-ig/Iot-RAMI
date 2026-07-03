/**************************************************** ENUM ****************************************************/

/**
 * Enum for User Fields
 * This includes fields for both backend and frontend, such as those found in user forms (e.g., confirmPassword).
 */
enum UserFields {
	ID = "id",
	EMAIL = "email",
	FIRST_NAME = "firstName",
	LAST_NAME = "lastName",
	DATE_OF_BIRTH = "dateOfBirth",
	SEX = "sex",
	ROLE = "role",
	PASSWORD = "password",
	CONFIRM_PASSWORD = "confirmPassword",
	NEW_PASSWORD = "newPassword",
	CONFIRM_NEW_PASSWORD = "confirmNewPassword",
	EXPIRES_AT = "expiresAt",
	TOKEN = "token",
}

/**
 * Enum for User Roles
 * Sorted by priority.
 */
enum Role {
	ADMIN = "admin",
	PRIVILEGED = "privileged",
	REGULAR = "regular",
}

/**
 * Enum for User Sex
 */
enum Sex {
	MALE = "male",
	FEMALE = "female",
	OTHER = "other",
	NOTSPECIFY = "not specify",
}

/************************************ INTERFACE (for request & responses) ****************************************************/

// HERE THESES INTERFACE CAN BE USED FOR BOTH REQUESTS & ANSWER (login, signup, update, get_all_user)

interface UserSignup {
	[UserFields.EMAIL]: string
	[UserFields.FIRST_NAME]: string
	[UserFields.LAST_NAME]: string
	[UserFields.DATE_OF_BIRTH]: string
	[UserFields.SEX]: Sex
	[UserFields.ROLE]?: Role
}

interface UserLoginBody {
	[UserFields.EMAIL]: string
	[UserFields.PASSWORD]: string
}

// RESPONSES (Here we do not really care about the answere format, may change though)

interface User {
	[UserFields.ID]: string
	[UserFields.FIRST_NAME]: string
	[UserFields.LAST_NAME]: string
	[UserFields.DATE_OF_BIRTH]: string
	[UserFields.SEX]: Sex
	[UserFields.EMAIL]: string
	[UserFields.PASSWORD]: string
	[UserFields.ROLE]: Role
}

/******************************************* ONLY CONCERN THE FRONT END **********************************************/

interface UserIsConnected {
	[UserFields.ID]: string
	[UserFields.EMAIL]: string
	[UserFields.FIRST_NAME]: string
	[UserFields.LAST_NAME]: string
	[UserFields.DATE_OF_BIRTH]: string
	[UserFields.SEX]: Sex
	[UserFields.ROLE]: Role
	[UserFields.EXPIRES_AT]: string
	[UserFields.TOKEN]: string
}

interface UserMailRole {
	[UserFields.EMAIL]: string
	[UserFields.ROLE]: Role
}

export type { User, UserIsConnected, UserLoginBody, UserMailRole, UserSignup }
export { UserFields, Role, Sex }
