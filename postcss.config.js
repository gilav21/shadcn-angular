// Read only by Vite/Vitest (postcss-load-config, from the repo root) so the
// browser suite can compile packages/styles.css's `@import "tailwindcss"`.
// The Angular builders (demo build, Storybook, ng-packagr) read JSON only —
// demo/.postcssrc.json — and never load this file. Do not delete it.
module.exports = {
    plugins: {
        '@tailwindcss/postcss': {},
    },
}
