/**
 * The probe grid's geographic axis.
 *
 * Deliberately free of node-only imports so both the server pipeline and the
 * client grid can read it. Pipeline events carry only locale ids, so the UI
 * needs this table to render human labels.
 */

import type { Locale } from "@/lib/types";

export const DEFAULT_LOCALES: Locale[] = [
  {
    id: "us-mn-minneapolis",
    location: "Minneapolis, Minnesota, United States",
    gl: "us",
    hl: "en",
    label: "Minneapolis, MN",
  },
  {
    id: "us-mn-saint-paul",
    location: "Saint Paul, Minnesota, United States",
    gl: "us",
    hl: "en",
    label: "St. Paul, MN",
  },
  {
    id: "us-il-chicago",
    location: "Chicago, Illinois, United States",
    gl: "us",
    hl: "en",
    label: "Chicago, IL",
  },
  {
    id: "us-wi-milwaukee",
    location: "Milwaukee, Wisconsin, United States",
    gl: "us",
    hl: "en",
    label: "Milwaukee, WI",
  },
  {
    id: "us-tx-austin",
    location: "Austin, Texas, United States",
    gl: "us",
    hl: "en",
    label: "Austin, TX",
  },
  {
    id: "us-co-denver",
    location: "Denver, Colorado, United States",
    gl: "us",
    hl: "en",
    label: "Denver, CO",
  },
  {
    id: "us-az-phoenix",
    location: "Phoenix, Arizona, United States",
    gl: "us",
    hl: "en",
    label: "Phoenix, AZ",
  },
  {
    id: "us-wa-seattle",
    location: "Seattle, Washington, United States",
    gl: "us",
    hl: "en",
    label: "Seattle, WA",
  },
];

/** Human label for a locale id, falling back to the id when unknown. */
export function localeLabel(id: string): string {
  return DEFAULT_LOCALES.find((l) => l.id === id)?.label ?? id;
}
