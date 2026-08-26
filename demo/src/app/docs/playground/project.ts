import type { Closure } from './closure';

/** The subset of a component's generated docs the playground needs. */
export interface PlaygroundDoc {
    readonly name: string;
    /**
     * e.g. `import { ButtonComponent } from '@/components/ui/button';`
     *
     * Null for an entry that exports no single primary class — today only
     * `rich-text-editor/full`. Without it the generated app has nothing to put
     * in `imports: []`, so there is no playground to build.
     */
    readonly importStatement: string | null;
    /** A compiling usage fragment, or null when the component has none. */
    readonly snippet: string | null;
    /** Why the snippet is absent, when it is. */
    readonly snippetSkipReason: string | null;
    /**
     * Set for a recipe rather than a registry component.
     *
     * A recipe already IS the App — a whole compiling component composing
     * several library components — so it needs no generated snippet or import
     * line. Its `components` are the closure roots to install.
     */
    readonly recipe?: {
        readonly code: string;
        readonly components: readonly string[];
    };
}

/** Everything `buildProject` needs. Fetching happens before this, never inside. */
export interface PlaygroundInput {
    readonly doc: PlaygroundDoc;
    readonly closure: Closure;
    readonly sources: {
        /** Keyed by the closure's `files` entries. */
        readonly ui: Readonly<Record<string, string>>;
        /** Keyed by the closure's `libFiles` entries. */
        readonly lib: Readonly<Record<string, string>>;
    };
    /** `demo/src/styles.css` as fetched from the repo. */
    readonly themeCss: string;
    /**
     * `playground-lock.json` as fetched from the repo.
     *
     * Shipping a lockfile is the single biggest thing that makes a playground
     * usable. Without one npm has to resolve the whole tree from the registry
     * on every boot, which measured at **113 s** inside a WebContainer before
     * `ng serve` was even reached; with one, install finished and the dev
     * server was starting by **23 s**. Every playground installs the identical
     * dependency set — no registry component declares `npmDependencies` — so a
     * single lockfile serves all of them.
     */
    readonly lockfile: string;
}

/** A complete file tree, ready to POST. */
export interface PlaygroundProject {
    readonly files: Readonly<Record<string, string>>;
}

/**
 * Pinned rather than floating so a playground that worked yesterday still
 * works today: a `^` range would let a future Angular release break every
 * generated project at once, with nothing in this repo having changed.
 */
const ANGULAR = '21.2.17';
const TYPESCRIPT = '~5.9.0';

/**
 * The packages `shadcn-angular init` installs into a consumer's project.
 * Kept in step with `packages/cli/src/core/init-core.ts` — a component that
 * compiles after `init` must compile here.
 */
const BASELINE_DEPENDENCIES = ['clsx', 'tailwind-merge', 'class-variance-authority'];
const BASELINE_DEV_DEPENDENCIES = ['tailwindcss', 'postcss', '@tailwindcss/postcss'];

/** Latest-compatible is fine for these; they are not the thing under test. */
const LOOSE = 'latest';

/**
 * Rewrite the docs site's stylesheet for the generated tree.
 *
 * The theme is **fetched**, never re-declared here: the components read
 * `--primary`, `--radius` and friends, and a hand-copied duplicate would drift
 * from `demo/src/styles.css` silently. Only the `@source` lines need changing —
 * they point at repo-relative paths that do not exist inside the playground, so
 * Tailwind would scan nothing and emit no utilities.
 */
export function playgroundStyles(themeCss: string): string {
    const withoutSources = themeCss
        .split('\n')
        .filter(line => !line.trimStart().startsWith('@source'))
        .join('\n');

    return withoutSources.replace(
        '@import "tailwindcss";',
        '@import "tailwindcss";\n\n@source "./**/*.{ts,html}";',
    );
}

/**
 * The single class name an `importStatement` brings in.
 *
 * Sliced rather than matched: every regex shape for this tripped
 * sonarjs/super-linear-regex, and the braces make the bounds unambiguous
 * without one.
 */
function importedClass(importStatement: string): string {
    const open = importStatement.indexOf('{');
    const close = importStatement.indexOf('}', open + 1);
    if (open === -1 || close === -1) return '';
    return importStatement.slice(open + 1, close).split(',')[0].trim();
}

function packageJson(closure: Closure): string {
    const dependencies: Record<string, string> = {
        '@angular/common': ANGULAR,
        '@angular/compiler': ANGULAR,
        '@angular/core': ANGULAR,
        '@angular/forms': ANGULAR,
        '@angular/platform-browser': ANGULAR,
        rxjs: '^7.8.0',
        tslib: '^2.6.0',
    };
    for (const dep of [...BASELINE_DEPENDENCIES, ...closure.npmDependencies]) {
        dependencies[dep] = LOOSE;
    }

    const devDependencies: Record<string, string> = {
        '@angular/build': ANGULAR,
        '@angular/cli': ANGULAR,
        '@angular/compiler-cli': ANGULAR,
        typescript: TYPESCRIPT,
    };
    for (const dep of BASELINE_DEV_DEPENDENCIES) devDependencies[dep] = LOOSE;

    return `${JSON.stringify({
        name: 'shadcn-angular-playground',
        private: true,
        scripts: { start: 'ng serve' },
        dependencies,
        devDependencies,
    }, null, 2)}\n`;
}

function angularJson(): string {
    return `${JSON.stringify({
        $schema: './node_modules/@angular/cli/lib/config/schema.json',
        version: 1,
        projects: {
            playground: {
                projectType: 'application',
                root: '',
                sourceRoot: 'src',
                architect: {
                    build: {
                        builder: '@angular/build:application',
                        options: {
                            browser: 'src/main.ts',
                            index: 'src/index.html',
                            tsConfig: 'tsconfig.json',
                            styles: ['src/styles.css'],
                        },
                        configurations: {
                            // `ng new` writes a `development` configuration and
                            // points `serve` at it; this generator did not, so
                            // `optimization` fell back to its `true` default
                            // and every `ng serve` boot ran a full production
                            // build — minified, tree-shaken, and 30.9 s inside
                            // a WebContainer against 21.1 s without. Measured
                            // on the same component in a real browser. The
                            // playground was both slower than and less
                            // representative than the consumer app it exists to
                            // imitate.
                            development: { optimization: false },
                        },
                    },
                    serve: {
                        builder: '@angular/build:dev-server',
                        options: {
                            buildTarget: 'playground:build:development',
                            // `@angular/build:dev-server` defaults to
                            // `host: "localhost"`, and a server bound to
                            // loopback inside a WebContainer is never seen by
                            // the host page: StackBlitz forwards a port only
                            // once something listens on `0.0.0.0`. Without
                            // this the build completes, the dev server reports
                            // `http://localhost:4200/`, and no preview ever
                            // opens — the reader watches `npm install && npm
                            // start` finish and then sits on `package.json`
                            // forever. Verified in a real browser: identical
                            // project, only this line differing.
                            host: '0.0.0.0',
                            // Vite (which the dev server wraps) rejects any
                            // request whose Host header is not allow-listed,
                            // and StackBlitz serves the preview from a
                            // generated `*.w-credentialless-staticblitz.com`
                            // origin that cannot be known ahead of time.
                            // `[]` — the default — turns the preview into
                            // "Blocked request. This host is not allowed."
                            // The container is ephemeral, public and holds
                            // nothing but generated demo code, so allowing any
                            // host costs nothing; pinning a domain list would
                            // silently reintroduce this hang the next time
                            // StackBlitz changes its preview origin.
                            allowedHosts: true,
                            // Angular hard-disables its disk cache under a
                            // WebContainer — `normalizeCacheOptions` defaults
                            // `enabled` to `!process.versions.webcontainer`,
                            // because persistent caching there buys nothing
                            // and grows browser memory. Prebundling requires
                            // that cache, so leaving it on (the default) only
                            // buys the reader a yellow "Prebundling has been
                            // configured but will not be used because caching
                            // has been disabled" line in the terminal while
                            // they are already waiting on a slow boot. Turning
                            // it off changes no behaviour — it was never going
                            // to run — and removes a warning that reads like a
                            // fault.
                            prebundle: false,
                        },
                    },
                },
            },
        },
    }, null, 2)}\n`;
}

function tsconfigJson(): string {
    return `${JSON.stringify({
        compilerOptions: {
            strict: true,
            target: 'ES2022',
            module: 'preserve',
            moduleResolution: 'bundler',
            skipLibCheck: true,
            experimentalDecorators: true,
            // Without this the component's own `@/components/...` imports —
            // and the importStatement the docs generate — cannot resolve.
            baseUrl: '.',
            paths: { '@/*': ['src/*'] },
        },
        angularCompilerOptions: { strictTemplates: true },
    }, null, 2)}\n`;
}

function appComponent(doc: PlaygroundDoc, snippet: string, importStatement: string): string {
    const cls = importedClass(importStatement);
    return [
        "import { ChangeDetectionStrategy, Component } from '@angular/core';",
        importStatement,
        '',
        '@Component({',
        "  selector: 'app-root',",
        '  changeDetection: ChangeDetectionStrategy.OnPush,',
        `  imports: [${cls}],`,
        '  template: `',
        '    <main class="min-h-screen bg-background p-8 text-foreground">',
        `      <h1 class="mb-6 text-xl font-semibold">${doc.name}</h1>`,
        `      ${snippet}`,
        '    </main>',
        '  `,',
        '})',
        'export class App {}',
        '',
    ].join('\n');
}

/**
 * A recipe's own source, used verbatim as the app's root component.
 *
 * Two edits only: the selector becomes `app-root`, which index.html
 * bootstraps, and the class is re-exported as `App`, which main.ts imports.
 * Nothing else is touched — the point of a recipe playground is that the
 * reader edits the exact file the e2e suite compiles.
 */
function recipeApp(code: string): string {
    const withRootSelector = code.replace(/selector:\s*'[^']*'/, "selector: 'app-root'");
    const declared = /export class (\w+)/.exec(code);
    const alias = declared ? `
export { ${declared[1]} as App };
` : '';
    return `${withRootSelector}${alias}`;
}

const MAIN_TS = [
    "import { bootstrapApplication } from '@angular/platform-browser';",
    "import { provideZonelessChangeDetection } from '@angular/core';",
    "import { App } from './app/app';",
    '',
    'bootstrapApplication(App, {',
    '  providers: [provideZonelessChangeDetection()],',
    '}).catch((error: unknown) => console.error(error));',
    '',
].join('\n');

/** Matches what `shadcn-angular init` writes (`core/init-core.ts`). */
const POSTCSS_RC = `${JSON.stringify({ plugins: { '@tailwindcss/postcss': {} } }, null, 4)}
`;

const INDEX_HTML = [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <title>shadcn-angular playground</title>',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  </head>',
    '  <body>',
    '    <app-root></app-root>',
    '  </body>',
    '</html>',
    '',
].join('\n');

/**
 * The file tree for one component's playground, or `null` when the component
 * has no snippet to render.
 *
 * Returning `null` rather than an empty project is deliberate: the caller uses
 * it to decide whether the button exists at all. A component that renders
 * nothing on its own should show no playground button, not a button that opens
 * an empty page (UC-5).
 */
export function buildProject(input: PlaygroundInput): PlaygroundProject | null {
    const { doc, closure, sources } = input;
    // A recipe supplies its own App component, so it needs neither snippet nor
    // import line; a registry component needs both.
    if (!doc.recipe && (!doc.snippet || !doc.importStatement)) return null;

    const files: Record<string, string> = {
        'package.json': packageJson(closure),
        // Keep in step with `packageJson` above: if the two disagree npm
        // silently falls back to a full resolve — the slow path this exists to
        // avoid — rather than failing. `project.spec.ts` pins the Angular
        // version in both to the same constant so the drift is caught.
        'package-lock.json': input.lockfile,
        // Without this Tailwind's postcss plugin never runs: the build still
        // succeeds and still emits a styles.css, so the app boots looking
        // completely unstyled rather than failing. `init` writes the same file
        // into a consumer's project for the same reason.
        '.postcssrc.json': POSTCSS_RC,
        'angular.json': angularJson(),
        'tsconfig.json': tsconfigJson(),
        'src/index.html': INDEX_HTML,
        'src/main.ts': MAIN_TS,
        'src/styles.css': playgroundStyles(input.themeCss),
        'src/app/app.ts': doc.recipe
            ? recipeApp(doc.recipe.code)
            : appComponent(doc, doc.snippet as string, doc.importStatement as string),
    };

    // `Object.hasOwn` rather than an `undefined` check: the index signature is
    // typed `string`, so TypeScript proves `!== undefined` always true and the
    // guard would read as dead code while still being needed at runtime for a
    // file the fetch did not return.
    for (const file of closure.files) {
        if (Object.hasOwn(sources.ui, file)) {
            files[`src/components/ui/${file}`] = sources.ui[file];
        }
    }
    for (const file of closure.libFiles) {
        if (Object.hasOwn(sources.lib, file)) {
            files[`src/components/lib/${file}`] = sources.lib[file];
        }
    }

    return { files };
}
