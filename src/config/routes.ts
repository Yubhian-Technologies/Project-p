import type { Role } from "../types/user";

export const ROUTES = {
  login: "/login",
  signup: "/signup",
  unauthorized: "/unauthorized",
  user: "/user",
  counsellor: "/counsellor",
  head: "/head",
  admin: "/admin",
  superAdmin: "/super-admin",
} as const;

export const DASHBOARD_PATH_BY_ROLE: Record<Role, string> = {
  user: ROUTES.user,
  counsellor: ROUTES.counsellor,
  head: ROUTES.head,
  admin: ROUTES.admin,
  "super-admin": ROUTES.superAdmin,
};
