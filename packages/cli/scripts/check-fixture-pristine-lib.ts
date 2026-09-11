/**
 * What "pristine" means for an e2e fixture app, as pure checks over file
 * contents so the gate can be unit-tested without git.
 *
 * The fixture apps are consumer projects the orchestrator installs into on
 * every run: `init` rewrites the scaffold (styles import, tsconfig paths,
 * package deps), `add` drops components under `src/components/`, and a
 * harness run points `app.routes.ts` at a test page. None of that may ever be
 * COMMITTED: a committed route to a test page breaks every pristine build,
 * and committed init output leaves `init` nothing to change, so specs that
 * rely on a dirty tree (`migrate`) pass or fail for the wrong reason. This
 * happened repeatedly through `git add -A` while a run was in flight.
 */

export const FIXTURE_APPS = ['e2e/fixture-app', 'e2e/fixture-app-21'] as const;

/** Scaffold files the check reads; each has a signature `init` or a run leaves behind. */
export const SCAFFOLD_FILES = ['src/app/app.routes.ts', 'src/styles.scss', 'tsconfig.json', 'package.json'] as const;

/** Paths that are install output: never tracked, whatever their content. */
export const FORBIDDEN_TRACKED_PREFIXES = [
    'src/components/',
    'src/app/test-pages/',
    'src/tailwind.css',
    'src/legacy-consumer.ts',
    'components.json',
    'components.lock.json',
    '.postcssrc.json',
] as const;

export interface FixtureSnapshot {
    /** Tracked file contents by fixture-relative path; missing files are absent. */
    readonly files: Readonly<Partial<Record<string, string>>>;
    /** Every tracked path under the fixture, fixture-relative. */
    readonly tracked: readonly string[];
}

/** Human-readable violations for one fixture; empty when it is pristine. */
export function fixtureViolations(snapshot: FixtureSnapshot): string[] {
    const out: string[] = [];
    const routes = snapshot.files['src/app/app.routes.ts'];
    if (routes !== undefined && !/routes:\s*Routes\s*=\s*\[\s*\]/.test(routes)) {
        out.push('src/app/app.routes.ts routes a page — the pristine table is `routes: Routes = []`');
    }
    if (routes?.includes('test-pages')) {
        out.push('src/app/app.routes.ts imports a harness test page');
    }
    const styles = snapshot.files['src/styles.scss'];
    if (styles?.includes('tailwind.css')) {
        out.push('src/styles.scss carries the `tailwind.css` import that `init` writes');
    }
    const tsconfig = snapshot.files['tsconfig.json'];
    if (tsconfig?.includes('"@/*"')) {
        out.push('tsconfig.json carries the `@/*` path alias that `init` writes');
    }
    const pkg = snapshot.files['package.json'];
    for (const dep of ['tailwindcss', 'class-variance-authority', 'tailwind-merge', '@tailwindcss/postcss']) {
        if (pkg?.includes(`"${dep}"`)) out.push(`package.json depends on ${dep}, which \`init\` installs`);
    }
    for (const tracked of snapshot.tracked) {
        if (FORBIDDEN_TRACKED_PREFIXES.some((prefix) => tracked === prefix || tracked.startsWith(prefix))) {
            out.push(`${tracked} is install output and must not be tracked`);
        }
    }
    return out;
}
