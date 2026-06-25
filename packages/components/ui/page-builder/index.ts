export * from './page-builder.component';
export * from './sub/property-editor.component';
// Stable public type entrypoint: re-export the page-builder types (PageData,
// ComponentMeta, …) through the barrel via the backward-compatible
// `page-builder.types` shim, so consumers can import them from
// `@/components/ui/page-builder` and the legacy
// `@/components/ui/page-builder/page-builder.types` path keeps resolving to the
// same relocated `lib` types.
export * from './page-builder.types';
