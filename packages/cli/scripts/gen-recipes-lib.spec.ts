/**
 * The recipe corpus and its generator.
 *
 * The compile proof for T-12 is `e2e/cli-specs/recipes.ts`, which builds every
 * recipe in a pristine consumer app. These tests cover the layer beneath it:
 * that the payload the demo app renders is the same bytes that get compiled,
 * that every recipe declares components the registry actually has, and that a
 * malformed header fails loudly instead of shipping a blank card.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildRecipes,
    parseRecipe,
    serializeRecipes,
    stripHeader,
    type Recipes,
    type RecipeSource,
} from './gen-recipes-lib.js';
import { loadRecipeSources } from './gen-recipes.js';
import type { RegistryJson } from './gen-llms-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const registry = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages/components/registry.json'), 'utf-8'),
) as RegistryJson;
const committedPath = path.join(REPO_ROOT, 'demo/public/recipes.json');
const committed = JSON.parse(fs.readFileSync(committedPath, 'utf-8')) as Recipes;
const sources = loadRecipeSources(REPO_ROOT);

function source(over: Partial<RecipeSource> = {}): RecipeSource {
    return {
        id: 'sample',
        file: 'e2e/recipes/sample.recipe.ts',
        contents: `/**
 * @title A sample
 * @summary Does a thing.
 * @components button, card
 */
import { Component } from '@angular/core';

export class SampleComponent {}
`,
        ...over,
    };
}

describe('parseRecipe', () => {
    it('reads title, summary and components from the header', () => {
        const recipe = parseRecipe(source());
        expect(recipe.title).toBe('A sample');
        expect(recipe.summary).toBe('Does a thing.');
        expect(recipe.components).toEqual(['button', 'card']);
    });

    it('builds one install command for the whole recipe', () => {
        expect(parseRecipe(source()).install)
            .toBe('npx @gilav21/shadcn-angular@latest add button card');
    });

    it('strips the metadata header from the published code', () => {
        const recipe = parseRecipe(source());
        expect(recipe.code).not.toContain('@title');
        expect(recipe.code.startsWith('import { Component }')).toBe(true);
    });

    it('keeps the component JSDoc, which is the part worth reading', () => {
        const withDoc = source({
            contents: `/**
 * @title T
 * @summary S
 * @components button
 */
/** Why this pattern exists. */
export class C {}
`,
        });
        expect(parseRecipe(withDoc).code).toContain('Why this pattern exists.');
    });

    it('refuses a file with no header', () => {
        expect(() => parseRecipe(source({ contents: 'export class C {}' })))
            .toThrow(/no JSDoc metadata header/);
    });

    it('refuses a header missing a tag rather than shipping a blank field', () => {
        const noSummary = source({ contents: '/**\n * @title T\n * @components button\n */\n' });
        expect(() => parseRecipe(noSummary)).toThrow(/missing @summary/);
        const noComponents = source({ contents: '/**\n * @title T\n * @summary S\n */\n' });
        expect(() => parseRecipe(noComponents)).toThrow(/missing @components/);
    });
});

describe('stripHeader', () => {
    it('removes only the first block comment', () => {
        expect(stripHeader('/** a */\n/** b */\nx')).toBe('/** b */\nx');
    });
});

describe('buildRecipes', () => {
    it('sorts by id so the payload is stable', () => {
        const built = buildRecipes([
            source({ id: 'z', file: 'e2e/recipes/z.recipe.ts' }),
            source({ id: 'a', file: 'e2e/recipes/a.recipe.ts' }),
        ]);
        expect(built.recipes.map(r => r.id)).toEqual(['a', 'z']);
    });

    it('is deterministic', () => {
        const once = serializeRecipes(buildRecipes(sources));
        expect(serializeRecipes(buildRecipes(sources))).toBe(once);
    });
});

describe('T-12 support: the committed recipe corpus', () => {
    it('has at least the four recipes the spec asks for', () => {
        expect(committed.recipes.length).toBeGreaterThanOrEqual(4);
    });

    it('regenerates byte-for-byte from the sources on disk', () => {
        expect(serializeRecipes(buildRecipes(sources)))
            .toBe(fs.readFileSync(committedPath, 'utf-8'));
    });

    it('publishes exactly the bytes the compile gate builds', () => {
        for (const recipe of committed.recipes) {
            const onDisk = fs.readFileSync(path.join(REPO_ROOT, recipe.file), 'utf-8');
            expect(stripHeader(onDisk)).toBe(recipe.code);
        }
    });

    it('names only components the registry actually ships', () => {
        for (const recipe of committed.recipes) {
            for (const name of recipe.components) {
                expect(Object.hasOwn(registry, name)).toBe(true);
            }
        }
    });

    it('composes several components per recipe — that is what makes it a recipe', () => {
        for (const recipe of committed.recipes) {
            expect(recipe.components.length).toBeGreaterThanOrEqual(3);
        }
    });

    it('gives every recipe an exported component class the gate can mount', () => {
        for (const recipe of committed.recipes) {
            expect(/export class \w+/.test(recipe.code)).toBe(true);
        }
    });

    it('imports through the consumer alias, not through repo-relative paths', () => {
        for (const recipe of committed.recipes) {
            expect(recipe.code).toContain("from '@/components/ui/");
            expect(recipe.code).not.toContain('../../packages/');
        }
    });

    it('covers distinct patterns rather than four takes on one', () => {
        const ids = committed.recipes.map(r => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        const allComponents = new Set(committed.recipes.flatMap(r => r.components));
        expect(allComponents.size).toBeGreaterThanOrEqual(8);
    });
});

describe('loadRecipeSources', () => {
    it('finds every .recipe.ts on disk, in name order', () => {
        expect(sources.length).toBeGreaterThanOrEqual(4);
        const ids = sources.map(s => s.id);
        expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    });

    it('returns an empty list for a directory that does not exist', () => {
        expect(loadRecipeSources(path.join(REPO_ROOT, 'no-such-root'))).toEqual([]);
    });
});
