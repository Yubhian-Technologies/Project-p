import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { listCampuses } from "../services/firebase/campuses";
import { listAcademicYearsForCampuses } from "../services/firebase/academicYears";
import type { AcademicYear } from "../types/academicYear";

const STORAGE_KEY_PREFIX = "vw.selectedAcademicYearLabel";

export interface AcademicYearContextValue {
  /** Academic years this viewer is allowed to see (already narrowed to their colleges). */
  years: AcademicYear[];
  /** Distinct labels, newest first — what the selector lists. */
  labels: string[];
  selectedLabel: string;
  setSelectedLabel: (label: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
  /**
   * The selected year's record for one campus (labels are matched per campus),
   * or null when that campus has no year with the selected label.
   */
  yearForCampus: (campusId: string | undefined) => AcademicYear | null;
  /**
   * Whether a record dated `timestamp` (and, when known, belonging to
   * `collegeId`) falls inside the selected academic year of its campus.
   * When no academic years exist for this viewer at all, nothing is filtered
   * — the feature is simply not in use yet.
   */
  includes: (timestamp: number, campusId: string | undefined, collegeId?: string) => boolean;
  /**
   * Same as `includes`, for month-granular records (monthly reports, session
   * report months): true when any part of calendar month `month` (1–12) of
   * `year` falls inside the selected academic year.
   */
  includesMonth: (year: number, month: number, campusId: string | undefined, collegeId?: string) => boolean;
  /** True when at least one academic year exists, i.e. filtering is active. */
  active: boolean;
}

export const AcademicYearContext = createContext<AcademicYearContextValue | undefined>(undefined);

function storageKey(uid: string): string {
  return `${STORAGE_KEY_PREFIX}.${uid}`;
}

function readStoredLabel(uid: string | undefined): string {
  if (!uid) return "";
  try {
    return localStorage.getItem(storageKey(uid)) ?? "";
  } catch {
    return "";
  }
}

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [allYears, setAllYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  // A browser can be shared by several staff logins. Keep each login's year
  // selection separate so changing the Management view never changes the
  // year selected for a counsellor, Head, or another Admin on that device.
  const [selection, setSelection] = useState<{ uid: string | undefined; label: string }>({ uid: undefined, label: "" });

  const role = profile?.role;
  const access = profile?.adminAccess;
  const campusId = profile?.campusId;

  // Which campuses' years this viewer may read, and which colleges they are
  // limited to (a counsellor: their own; a college-restricted Admin: theirs).
  const scope = useMemo(() => {
    if (role === "counsellor") {
      return { campusIds: campusId ? [campusId] : [], collegeIds: profile?.collegeId ? [profile.collegeId] : null };
    }
    if (role === "head") return { campusIds: campusId ? [campusId] : [], collegeIds: null };
    if (role === "admin" && access?.scope === "campuses") {
      return {
        campusIds: access.campusIds ?? [],
        collegeIds: access.collegeIds?.length ? access.collegeIds : null,
      };
    }
    if (role === "admin" || role === "super-admin") return { campusIds: null, collegeIds: null }; // every campus
    return null; // students etc. don't use academic years
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, campusId, profile?.collegeId, access]);

  const load = useCallback(async () => {
    if (!scope) {
      setAllYears([]);
      return;
    }
    setLoading(true);
    try {
      const campusIds = scope.campusIds ?? (await listCampuses()).map((c) => c.id);
      const years = await listAcademicYearsForCampuses(campusIds);
      setAllYears(
        scope.collegeIds ? years.filter((y) => y.collegeIds.some((c) => scope.collegeIds?.includes(c))) : years,
      );
    } catch {
      setAllYears([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (uid) void load();
    else setAllYears([]);
  }, [uid, load]);

  const labels = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const y of allYears) {
      if (!seen.has(y.label)) {
        seen.add(y.label);
        out.push(y.label);
      }
    }
    return out;
  }, [allYears]);

  // Default: the year that contains today, else the newest one.
  const effectiveLabel = useMemo(() => {
    const selectedLabel = selection.uid === uid ? selection.label : readStoredLabel(uid);
    if (labels.includes(selectedLabel)) return selectedLabel;
    const now = Date.now();
    const current = allYears.find((y) => y.startDate <= now && now <= y.endDate);
    return current?.label ?? labels[0] ?? "";
  }, [labels, selection, uid, allYears]);

  const setSelectedLabel = useCallback((label: string) => {
    setSelection({ uid, label });
    try {
      if (uid) localStorage.setItem(storageKey(uid), label);
    } catch {
      // Non-critical convenience only.
    }
  }, [uid]);

  const yearForCampus = useCallback(
    (forCampusId: string | undefined) =>
      forCampusId ? (allYears.find((y) => y.campusId === forCampusId && y.label === effectiveLabel) ?? null) : null,
    [allYears, effectiveLabel],
  );

  const includes = useCallback(
    (timestamp: number, forCampusId: string | undefined, collegeId?: string) => {
      if (allYears.length === 0) return true;
      const year = yearForCampus(forCampusId);
      if (!year) return false;
      if (timestamp < year.startDate || timestamp > year.endDate) return false;
      // Records of a college that isn't part of this year are out of it.
      // Records with no known college (older data) stay visible.
      if (collegeId && !year.collegeIds.includes(collegeId)) return false;
      return true;
    },
    [allYears, yearForCampus],
  );

  const includesMonth = useCallback(
    (year: number, month: number, forCampusId: string | undefined, collegeId?: string) => {
      if (allYears.length === 0) return true;
      const y = yearForCampus(forCampusId);
      if (!y) return false;
      const monthStart = new Date(year, month - 1, 1).getTime();
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();
      if (monthEnd < y.startDate || monthStart > y.endDate) return false;
      if (collegeId && !y.collegeIds.includes(collegeId)) return false;
      return true;
    },
    [allYears, yearForCampus],
  );

  const value: AcademicYearContextValue = {
    years: allYears,
    labels,
    selectedLabel: effectiveLabel,
    setSelectedLabel,
    loading,
    reload: load,
    yearForCampus,
    includes,
    includesMonth,
    active: allYears.length > 0,
  };

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}
