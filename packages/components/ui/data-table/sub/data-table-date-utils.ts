/** Shared date helpers for the data-table date filter sub-components. */

export function toDateOnlyTimestamp(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
