/**
 * Builder for `demo/public/recipes.json`.
 *
 * A recipe is a real, compiling consumer component under `e2e/recipes/`, not a
 * prose snippet. That file is the single source of truth: the compile gate
 * (`e2e/cli-specs/recipes.ts`) builds it in the fixture app, and this module
 * turns the same bytes into the payload the demo app renders. There is no
 * second copy to fall out of step.
 *
 * Metadata rides in a JSDoc header on the file:
 *
 *   @title      one line, shown as the recipe heading
 *   @summary    one sentence, shown under it
 *   @components comma-separated registry names the recipe installs
 *
 * Pure — no IO. `gen-recipes.ts` supplies the file contents.
 */
import { CLI_PACKAGE } from './gen-llms-lib.js';

/** One recipe, ready to render. */
export interface Recipe {
    /** Slug, taken from the file name. */
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    /** Registry component names the recipe uses. */
    readonly components: readonly string[];
    /** The single command that installs all of them. */
    readonly install: string;
    /** The recipe source, verbatim apart from the metadata header. */
    readonly code: string;
    /** Repo-relative path of the source, so the docs can point at it. */
    readonly file: string;
}

export interface Recipes {
    readonly version: 1;
    readonly recipes: readonly Recipe[];
}

/** A raw recipe file as read from disk. */
export interface RecipeSource {
    readonly id: string;
    readonly file: string;
    readonly contents: string;
}

const HEADER = /^\/\*\*([\s\S]*?)\*\//;

function tag(header: string, name: string): string {
    const match = new RegExp(String.raw`@${name}\s+([^\n]*)`).exec(header);
    return match ? match[1].trim() : '';
}

/**
 * Strip the metadata header from the source. The header exists to drive this
 * generator; leaving it in the published code would teach readers to write it
 * in their own components, which does nothing for them.
 */
export function stripHeader(contents: string): string {
    return contents.replace(HEADER, '').trimStart();
}

/** Parse one recipe file. Throws on a missing tag rather than shipping a blank field. */
export function parseRecipe(source: RecipeSource): Recipe {
    const header = HEADER.exec(source.contents);
    if (!header) {
        throw new Error(`${source.file} has no JSDoc metadata header.`);
    }
    const title = tag(header[1], 'title');
    const summary = tag(header[1], 'summary');
    const components = tag(header[1], 'components')
        .split(',')
        .map(name => name.trim())
        .filter(name => name !== '');

    for (const [name, value] of [['title', title], ['summary', summary]] as const) {
        if (value === '') throw new Error(`${source.file} is missing @${name}.`);
    }
    if (components.length === 0) throw new Error(`${source.file} is missing @components.`);

    return {
        id: source.id,
        title,
        summary,
        components,
        install: `npx ${CLI_PACKAGE}@latest add ${components.join(' ')}`,
        code: stripHeader(source.contents),
        file: source.file,
    };
}

/** Build the payload. Deterministic: sorted by id, no clock, no IO. */
export function buildRecipes(sources: readonly RecipeSource[]): Recipes {
    const recipes = [...sources]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(parseRecipe);
    return { version: 1, recipes };
}

/** Serialize exactly as committed (stable, newline-terminated). */
export function serializeRecipes(recipes: Recipes): string {
    return JSON.stringify(recipes, null, 2) + '\n';
}
