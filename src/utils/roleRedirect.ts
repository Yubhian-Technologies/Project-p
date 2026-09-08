import type { Role } from "../types/user";
import { DASHBOARD_PATH_BY_ROLE } from "../config/routes";

export function dashboardPathForRole(role: Role | null): string {
  if (!role) return "/login";
  return DASHBOARD_PATH_BY_ROLE[role];
}
