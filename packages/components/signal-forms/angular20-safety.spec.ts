/**
 * T-7 — the Angular 20 guarantee (UC-4), as the fallback the spec's R-5 allows.
 *
 * The spec's first choice was to build the e2e fixture app against Angular 20.
 * That is not practical here: the fixture installs from the workspace, so
 * pinning it to Angular 20 means resolving a second full Angular tree, and the
 * suite that would run it takes minutes per component. R-5 explicitly permits
 * downgrading to a static check "and say so in the retro" — this is that check,
 * and it is the one that would actually catch the regression it is guarding
 * against.
 *
 * The guarantee: satisfying `FormValueControl` is *structural*. `model()` has
 * existed since Angular 17.2, so every converted component compiles unchanged
 * on Angular 20 — provided no shipped file imports `@angular/forms/signals`,
 * which exists only on 21. That import is the single thing that would break an
 * Angular 20 consumer, and it is what this test forbids.
 *
 * Sources are inlined by `import.meta.glob` at build time, so this runs in the
 * browser suite like everything else.
 */
import { describe, expect, it } from 'vitest';

/**
 * `import.meta.glob` is a Vite build-time transform, not a TS lib member, and
 * this workspace does not pull in `vite/client`'s ambient types. Declared here
 * with exactly the shape used below rather than widening the whole program.
 */
declare global {
    interface ImportMeta {
        glob(
            pattern: string,
            options: { readonly query: string; readonly import: string; readonly eager: true },
        ): Record<string, string>;
    }
}

const SIGNALS_ENTRYPOINT = '@angular/forms/signals';

const shippedSources = import.meta.glob('../{ui,lib}/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
});

const conformanceSources = import.meta.glob('./*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
});

const importsSignals = (source: string): boolean =>
    source.includes(`'${SIGNALS_ENTRYPOINT}'`) || source.includes(`"${SIGNALS_ENTRYPOINT}"`);

describe('T-7: the library still builds on Angular 20', () => {
    it('sees the shipped sources at all (positive control for the glob)', () => {
        const paths = Object.keys(shippedSources);

        expect(paths.length).toBeGreaterThan(100);
        expect(paths.some(p => p.includes('select/select.component.ts'))).toBe(true);
        expect(paths.some(p => p.includes('input-otp/input-otp.component.ts'))).toBe(true);
    });

    it('no file under ui/ or lib/ imports the Angular-21-only signals entrypoint', () => {
        const offenders = Object.entries(shippedSources)
            .filter(([, source]) => importsSignals(source))
            .map(([path]) => path);

        expect(offenders).toEqual([]);
    });

    it('the conformance tests that do import it live outside ui/, where nothing ships them', () => {
        const importers = Object.entries(conformanceSources)
            .filter(([, source]) => importsSignals(source))
            .map(([path]) => path);

        expect(importers.length).toBeGreaterThan(0);
        expect(importers.every(path => !path.includes('/ui/'))).toBe(true);
    });

    it('the converted controls use only `model()`, which predates Angular 21', () => {
        const converted = [
            'select/select.component.ts',
            'autocomplete/autocomplete.component.ts',
            'number-input/number-input.component.ts',
            'phone-input/phone-input.component.ts',
            'radio-group/radio-group.component.ts',
            'slider/slider.component.ts',
            'toggle-group/toggle-group.component.ts',
            'input/input.component.ts',
            'textarea/textarea.component.ts',
            'rating/rating.component.ts',
            'input-group/sub/input-group-input.component.ts',
            'color-picker/color-picker.component.ts',
        ];

        for (const suffix of converted) {
            const entry = Object.entries(shippedSources).find(([path]) => path.endsWith(suffix));
            expect(entry, `no source found for ${suffix}`).toBeDefined();
            const source = shippedSources[(entry as [string, string])[0]];
            expect(source, `${suffix} should declare a value model`).toMatch(/value = model[<(]/);
            expect(importsSignals(source)).toBe(false);
        }
    });
});
