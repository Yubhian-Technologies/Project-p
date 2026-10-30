import { useEffect, useState } from "react";
import { listCampuses } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import { Select } from "../common/Select";
import "./CampusFilterSelect.css";

interface CampusFilterSelectProps {
  value: string; // "" = all campuses
  onChange: (campusId: string) => void;
  /** null = every campus (Super Admin, or a legacy/global admin) — see
      allowedCampusIdsFor(). */
  allowedCampusIds: string[] | null;
}

/** Lets a wide-scoped viewer (Management/global Admin, Super Admin) narrow
    a counsellor/head list down to one campus at a time instead of always
    seeing every campus they manage mixed together. Hides itself once
    there's nothing to filter — exactly one (or zero) campuses in scope —
    so a Head/Principal/VP/Administration viewer, who only ever has one
    campus anyway, never sees a pointless single-option dropdown. */
export function CampusFilterSelect({ value, onChange, allowedCampusIds }: CampusFilterSelectProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);

  useEffect(() => {
    listCampuses().then((all) => {
      setCampuses(allowedCampusIds ? all.filter((c) => allowedCampusIds.includes(c.id)) : all);
    });
    // allowedCampusIds is an array — compare by content, not identity, so this
    // doesn't refetch every render just because a new array literal was passed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedCampusIds?.join(",") ?? ""]);

  if (campuses.length <= 1) return null;

  return (
    <div className="campus-filter">
      <label htmlFor="campus-filter">Campus</label>
      <Select id="campus-filter" value={value} onChange={onChange}>
        <option value="">All campuses</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
