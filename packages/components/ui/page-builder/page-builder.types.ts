// Backward-compatible re-export. The page-builder types (PageData,
// ComponentMeta, …) now live in `lib/page-builder.types.ts` so they can be
// shared, but consumers historically imported them from
// `@/components/ui/page-builder/page-builder.types`. Keeping this thin
// re-export preserves that path AND guarantees the old path and the relocated
// `lib` copy resolve to the SAME types — without it, a project that still has a
// stale duplicate of this file gets two nominally-distinct `PageData` types and
// a TS2345 clash (report B7). Prefer importing from the barrel
// `@/components/ui/page-builder`.
export * from '../../lib/page-builder.types';
