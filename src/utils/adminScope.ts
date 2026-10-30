import type { UserProfile } from "../types/user";

/**
 * Mirrors firestore.rules' adminCanAccessCollege(): whether `viewer` (an
 * admin or super-admin) may manage/see `target`'s campus-scoped data.
 * - Super Admin, and a legacy/global admin (no adminAccess, or scope
 *   "global"), see everyone.
 * - A campus-scoped admin with no collegeIds configured — Management —
 *   keeps whole-campus access across every campus they're assigned.
 * - A campus-scoped admin WITH collegeIds configured — Principal/
 *   Vice-Principal/Administration — is narrowed to exactly those colleges,
 *   same as the rest of the Admin dashboard (e.g. AttendanceSection).
 */
export function adminCanSeeStaff(viewer: UserProfile, target: UserProfile): boolean {
  if (viewer.role === "super-admin") return true;
  if (viewer.role !== "admin") return false;
  const access = viewer.adminAccess;
  if (!access || access.scope === "global") return true;
  if (!target.campusId || !(access.campusIds ?? []).includes(target.campusId)) return false;
  if (!access.collegeIds || access.collegeIds.length === 0) return true;
  return !!target.collegeId && access.collegeIds.includes(target.collegeId);
}

/** The campus ids a viewer's own access is restricted to, for feeding a
    campus-filter dropdown — null means "every campus" (Super Admin, or a
    legacy/global admin), never an empty-but-meaningful restriction. Only
    meaningful for admin/super-admin viewers; callers should guard by role. */
export function allowedCampusIdsFor(viewer: UserProfile): string[] | null {
  if (viewer.role === "super-admin") return null;
  const access = viewer.adminAccess;
  if (!access || access.scope === "global") return null;
  return access.campusIds ?? [];
}
