/**
 * Builder for the generated block in the repo README.
 *
 * Two claims a developer reads before deciding to try the library — "how much
 * does this cost me in dependencies" and "does it work on my Angular" — are
 * exactly the two most likely to rot. Both are derivable, so both are
 * generated: the dependency count from `registry.json`, the version matrix
 * from the `package.json` files of the workspaces that are actually built and
 * tested. `gen-readme.ts --check` fails when the committed README drifts.
 *
 * Pure — no IO. `gen-readme.ts` supplies the file contents.
 */
import type { RegistryJson } from './gen-llms-lib.js';

/** Markers delimiting the generated region. Everything between them is owned here. */
export const BEGIN = '<!-- BEGIN GENERATED: facts (npm run docs:readme) -->';
export const END = '<!-- END GENERATED: facts -->';

/** One row of the tested-version matrix. */
export interface VersionRow {
    /** What is being pinned, e.g. `Angular`. */
    readonly name: string;
    /** Version the library itself is developed against. */
    readonly developed: string;
    /** Version a real consumer install is built against by the e2e gate. */
    readonly verified: string;
}

export interface ReadmeFacts {
    readonly components: number;
    readonly addons: number;
    readonly blocks: number;
    /** Components whose install pulls an npm package. Zero is the headline. */
    readonly withNpmDependencies: number;
    readonly versions: readonly VersionRow[];
}

/** The `package.json` subset needed to read a pin. */
export interface PackageJson {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
}

/** Look a pin up in either dependency block. */
export function pinOf(pkg: PackageJson, name: string): string | null {
    return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? null;
}

/**
 * Collapse several `package.json` files into one view of the pins, earlier
 * files winning. The library's versions are split across the workspace root
 * (TypeScript, tooling) and the demo app (Angular), so neither alone can
 * answer "what is this developed against".
 */
export function mergePins(...packages: readonly PackageJson[]): PackageJson {
    const dependencies: Record<string, string> = {};
    for (const pkg of [...packages].reverse()) {
        Object.assign(dependencies, pkg.devDependencies, pkg.dependencies);
    }
    return { dependencies };
}

/** Strip a range prefix so the matrix reads as a version, not a constraint. */
export function bareVersion(pin: string): string {
    return pin.replace(/^[\^~><= ]+/, '');
}

/**
 * Count what the registry ships. `npmDependencies` is optional on an entry, so
 * an absent key counts as zero — which is the whole point of the claim.
 */
export function countRegistry(registry: RegistryJson): Omit<ReadmeFacts, 'versions'> {
    let components = 0;
    let addons = 0;
    let blocks = 0;
    let withNpmDependencies = 0;
    for (const entry of Object.values(registry)) {
        if (entry.type === 'block') blocks++;
        else if (entry.type === 'addon') addons++;
        else components++;
        if ((entry.npmDependencies ?? []).length > 0) withNpmDependencies++;
    }
    return { components, addons, blocks, withNpmDependencies };
}

/** The packages the matrix reports, in the order it lists them. */
const MATRIX: readonly { readonly name: string; readonly pkg: string }[] = [
    { name: 'Angular', pkg: '@angular/core' },
    { name: 'TypeScript', pkg: 'typescript' },
];

/**
 * Build the matrix from the workspace that develops the library and the
 * fixture app the e2e suite installs into. Those are the only two numbers
 * anyone can honestly claim: one is what the source is written against, the
 * other is what a pristine consumer install is proven to build on.
 */
export function buildVersions(library: PackageJson, fixture: PackageJson): VersionRow[] {
    return MATRIX.flatMap(({ name, pkg }) => {
        const developed = pinOf(library, pkg);
        const verified = pinOf(fixture, pkg);
        if (developed === null || verified === null) return [];
        return [{ name, developed: bareVersion(developed), verified: bareVersion(verified) }];
    });
}

export function buildFacts(
    registry: RegistryJson, library: PackageJson, fixture: PackageJson,
): ReadmeFacts {
    return { ...countRegistry(registry), versions: buildVersions(library, fixture) };
}

function majorOf(version: string): string {
    return version.split('.')[0];
}

/** Line separators, named so the escapes survive tooling that rewrites source. */
const LF = String.fromCodePoint(10);
const CRLF = String.fromCodePoint(13, 10);

/** Render the generated block, markers included. Always LF; `applyFacts` adapts. */
export function renderFacts(facts: ReadmeFacts): string {
    const total = facts.components + facts.addons;
    const rows = facts.versions
        .map(row => `| ${row.name} | ${row.developed} | ${row.verified} |`)
        .join(LF);

    const angular = facts.versions.find(row => row.name === 'Angular');
    const majors = angular
        ? [...new Set([majorOf(angular.developed), majorOf(angular.verified)])]
            .sort((a, b) => a.localeCompare(b))
        : [];
    const majorSentence = majors.length > 1
        ? `Angular ${majors.join(' and ')} are both covered.`
        : `Angular ${majors[0] ?? '?'} is covered.`;

    return [
        BEGIN,
        '',
        '## 0 runtime dependencies',
        '',
        `All **${total}** components and addons install as source you own. ` +
        `**${facts.withNpmDependencies}** of them pull an npm package: the CLI copies ` +
        'TypeScript, HTML and CSS into your project and adds nothing to your ' +
        '`package.json`. There is no `@shadcn-angular/*` runtime to depend on, to keep ' +
        'in version lockstep, or to wait on for a fix — you edit the component in place.',
        '',
        `Registry today: ${facts.components} components, ${facts.addons} opt-in addons, ` +
        `${facts.blocks} composed blocks.`,
        '',
        '## Tested versions',
        '',
        '| | Developed against | Verified in a consumer install |',
        '|---|---|---|',
        rows,
        '',
        '"Verified in a consumer install" is not a compatibility promise on paper: every ' +
        'release runs the e2e suite, which `init`s a pristine Angular app, `add`s ' +
        'components into it exactly as a user would, and builds it with ' +
        `\`strictTemplates\`. ${majorSentence}`,
        '',
        END,
    ].join(LF);
}

/**
 * Replace the generated block in a README, keeping the file's existing line
 * endings. This repo's README is CRLF; rendering LF into it would rewrite every
 * line and bury a two-paragraph change in a whole-file diff.
 */
export function applyFacts(readme: string, facts: ReadmeFacts): string {
    const start = readme.indexOf(BEGIN);
    const end = readme.indexOf(END);
    if (start === -1 || end === -1 || end < start) {
        throw new Error(`README is missing the generated markers (${BEGIN} … ${END}).`);
    }
    const newline = readme.includes(CRLF) ? CRLF : LF;
    const block = renderFacts(facts).replaceAll(LF, newline);
    return readme.slice(0, start) + block + readme.slice(end + END.length);
}
