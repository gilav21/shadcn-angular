import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { isValidLocaleCode, setLocaleCore, I18N_LIB_FILES } from './set-locale.js';

const TOKEN_SOURCE = `import { InjectionToken, signal, type Signal } from '@angular/core';

export const UI_LOCALE_ID = new InjectionToken<Signal<string>>('UI_LOCALE_ID', {
    providedIn: 'root',
    factory: () => signal('en').asReadonly(),
});
`;

describe('isValidLocaleCode', () => {
    it('accepts simple and subtagged BCP-47 codes', () => {
        expect(isValidLocaleCode('en')).toBe(true);
        expect(isValidLocaleCode('he')).toBe(true);
        expect(isValidLocaleCode('pt-BR')).toBe(true);
        expect(isValidLocaleCode('zh-Hant')).toBe(true);
    });

    it('rejects malformed codes', () => {
        expect(isValidLocaleCode('')).toBe(false);
        expect(isValidLocaleCode('EN')).toBe(false);
        expect(isValidLocaleCode('english')).toBe(false);
        expect(isValidLocaleCode("en'); alert('x")).toBe(false);
    });
});

describe('setLocaleCore', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'set-locale-'));
        await fs.writeJson(path.join(dir, 'components.json'), {
            style: 'default',
            tailwind: { css: 'src/styles.scss', baseColor: 'neutral', theme: 'zinc', cssVariables: true },
            aliases: { components: '@/components', utils: '@/components/lib', ui: '@/components/ui' },
        });
    });

    afterEach(async () => {
        await fs.remove(dir);
    });

    const tokenPath = () => path.join(dir, 'src', 'components', 'lib', 'i18n', 'i18n.token.ts');

    it('rewrites the UI_LOCALE_ID default in an installed i18n.token.ts', async () => {
        await fs.ensureDir(path.dirname(tokenPath()));
        await fs.writeFile(tokenPath(), TOKEN_SOURCE);

        const message = await setLocaleCore('he', dir);

        const updated = await fs.readFile(tokenPath(), 'utf-8');
        expect(updated).toContain("factory: () => signal('he').asReadonly()");
        expect(updated).not.toContain("signal('en')");
        expect(message).toContain('"he"');
    });

    it('is idempotent — a second call rewrites the new default', async () => {
        await fs.ensureDir(path.dirname(tokenPath()));
        await fs.writeFile(tokenPath(), TOKEN_SOURCE);

        await setLocaleCore('he', dir);
        await setLocaleCore('fr', dir);

        const updated = await fs.readFile(tokenPath(), 'utf-8');
        expect(updated).toContain("factory: () => signal('fr').asReadonly()");
    });

    it('installs the i18n lib files from the local registry when missing', async () => {
        await setLocaleCore('de', dir);

        for (const libFile of I18N_LIB_FILES) {
            expect(await fs.pathExists(path.join(dir, 'src', 'components', 'lib', libFile))).toBe(true);
        }
        const updated = await fs.readFile(tokenPath(), 'utf-8');
        expect(updated).toContain("signal('de').asReadonly()");
    });

    it('throws on an invalid locale code', async () => {
        await expect(setLocaleCore('not a locale', dir)).rejects.toThrow(/Invalid locale code/);
    });

    it('throws when the project is not initialized', async () => {
        await fs.remove(path.join(dir, 'components.json'));
        await expect(setLocaleCore('he', dir)).rejects.toThrow(/not initialized/);
    });

    it('throws when the factory expression was customized away', async () => {
        await fs.ensureDir(path.dirname(tokenPath()));
        await fs.writeFile(tokenPath(), 'export const UI_LOCALE_ID = somethingElse;');
        await expect(setLocaleCore('he', dir)).rejects.toThrow(/customized/);
    });
});
