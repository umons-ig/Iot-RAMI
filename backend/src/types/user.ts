import { Model, BuildOptions } from "sequelize";

enum Role {
  ADMIN = "admin", // can do anything
  PRIVILEGED = "privileged", // can do anything except create admin (can accept sensor creation, can accept user promotion)
  REGULAR = "regular", // first role of a new user (can ask for promotion, can ask for creation of new sensors or access to existing ones)
} // sort by priority

enum Sex {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
  NOTSPECIFY = "not specify",
}

interface UserCreation {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  sex: Sex;
  email: string | null;
  password: string | null;
  role: Role;
  refreshTokenVersion?: number;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  sex: Sex;
  email: string | null;
  password: string | null;
  role: Role;
  refreshTokenVersion: number;
}

type UserModel = Model<User, UserCreation>;

// Allow you to define a static method to define associations at the model class level
type UserStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (values?: Record<string, unknown>, options?: BuildOptions): UserModel;
};

interface UserPayload {
  userId: string;
  role: Role;
  tokenVersion: number;
  iat: number;
  exp: number;
}

const isBetterThan = (role1: Role, role2: Role) => {
  const roles = [Role.ADMIN, Role.PRIVILEGED, Role.REGULAR];
  return roles.indexOf(role1) >= roles.indexOf(role2);
};

const isStrictlyBetterThan = (role1: Role, role2: Role) => {
  const roles = [Role.ADMIN, Role.PRIVILEGED, Role.REGULAR];
  return roles.indexOf(role1) > roles.indexOf(role2);
};

export type { User, UserCreation, UserModel, UserStatic, UserPayload };
export { Role, Sex, isBetterThan, isStrictlyBetterThan };
