import { useState } from "react";

const DEFAULT_INITIAL_VISIBLE = 5;

/**
 * Caps a list to `initialVisible` items until "View More" is clicked — same
 * pattern as the shared ReportList component, factored out so any list that
 * can keep growing over time (campuses, logins, reports, ratings, …) gets
 * the same treatment instead of rendering every record at once.
 */
export function useViewMore<T>(items: T[], initialVisible = DEFAULT_INITIAL_VISIBLE) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialVisible);
  const hiddenCount = items.length - visible.length;
  return { visible, hiddenCount, expanded, showMore: () => setExpanded(true) };
}
