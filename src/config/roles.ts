import type { Role } from "../types/user";

export const ROLES: Role[] = ["user", "counsellor", "head", "admin", "super-admin"];

export const DEFAULT_ROLE: Role = "user";

export const ROLE_LABELS: Record<Role, string> = {
  user: "User",
  counsellor: "Counsellor",
  head: "Head",
  admin: "Admin",
  "super-admin": "Super Admin",
};
