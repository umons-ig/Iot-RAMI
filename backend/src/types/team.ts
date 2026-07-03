import { Model, BuildOptions } from "sequelize";

/* ───────────────────────── Team ───────────────────────── */
interface TeamCreation {
  id?: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}
interface Team {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}
type TeamModel = Model<Team, TeamCreation>;
type TeamStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (values?: Record<string, unknown>, options?: BuildOptions): TeamModel;
};

/* ──────────────────── TeamMember (user ∈ team) ──────────────────── */
interface TeamMemberCreation {
  id?: string;
  teamId: string;
  userId: string;
  createdAt?: Date;
}
interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  createdAt?: Date;
}
type TeamMemberModel = Model<TeamMember, TeamMemberCreation>;
type TeamMemberStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): TeamMemberModel;
};

/* ──────────────── UserZoneAccess (user → zone, cascade) ──────────────── */
interface UserZoneAccessCreation {
  id?: string;
  userId: string;
  zoneId: string;
  createdAt?: Date;
}
interface UserZoneAccess {
  id: string;
  userId: string;
  zoneId: string;
  createdAt?: Date;
}
type UserZoneAccessModel = Model<UserZoneAccess, UserZoneAccessCreation>;
type UserZoneAccessStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): UserZoneAccessModel;
};

/* ──────────────── TeamZoneAccess (team → zone, cascade) ──────────────── */
interface TeamZoneAccessCreation {
  id?: string;
  teamId: string;
  zoneId: string;
  createdAt?: Date;
}
interface TeamZoneAccess {
  id: string;
  teamId: string;
  zoneId: string;
  createdAt?: Date;
}
type TeamZoneAccessModel = Model<TeamZoneAccess, TeamZoneAccessCreation>;
type TeamZoneAccessStatic = typeof Model & {
  associate?: (models: any) => void;
} & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions
  ): TeamZoneAccessModel;
};

export type {
  Team,
  TeamCreation,
  TeamModel,
  TeamStatic,
  TeamMember,
  TeamMemberCreation,
  TeamMemberModel,
  TeamMemberStatic,
  UserZoneAccess,
  UserZoneAccessCreation,
  UserZoneAccessModel,
  UserZoneAccessStatic,
  TeamZoneAccess,
  TeamZoneAccessCreation,
  TeamZoneAccessModel,
  TeamZoneAccessStatic,
};
