// T-3, T-4, T-5 from `specs/stackblitz-playground-spec.md` §2.1.
//
// The generator turns a resolved closure plus fetched source into the exact
// file tree StackBlitz will boot. Everything here is pure: fetching lives
// elsewhere, so these tests never touch the network.
import { describe, it, expect } from 'vitest';
import { buildProject, playgroundStyles, type PlaygroundInput } from './project';
import type { Closure } from './closure';

const CLOSURE: Closure = {
    components: ['button', 'ripple'],
    files: ['button/button.component.ts', 'button/index.ts', 'ripple.directive.ts'],
    libFiles: ['utils.ts'],
    npmDependencies: ['class-variance-authority'],
    missing: [],
};

const INPUT: PlaygroundInput = {
    doc: {
        name: 'button',
        importStatement: "import { ButtonComponent } from '@/components/ui/button';",
        snippet: '<ui-button>Click me</ui-button>',
        snippetSkipReason: null,
    },
    closure: CLOSURE,
    sources: {
        ui: {
            'button/button.component.ts': 'export class ButtonComponent {}',
            'button/index.ts': "export * from './button.component';",
            'ripple.directive.ts': 'export class RippleDirective {}',
        },
        lib: { 'utils.ts': 'export const cn = () => "";' },
    },
    themeCss: [
        '@import "tailwindcss";',
        '@source "../src/**/*.ts";',
        '@source "../../packages/**/*.html";',
        ':root { --primary: oklch(0.205 0 0); }',
    ].join('\n'),
};

function build(): Record<string, string> {
    const project = buildProject(INPUT);
    if (!project) throw new Error('expected a project');
    return project.files;
}

describe('T-3 package.json carries the baseline and the closure packages', () => {
    it('includes the three packages every installed component needs', () => {
        const pkg = JSON.parse(build()['package.json']) as {
            dependencies: Record<string, string>;
        };
        // Same baseline `shadcn-angular init` installs.
        expect(Object.keys(pkg.dependencies)).toEqual(
            expect.arrayContaining(['clsx', 'tailwind-merge', 'class-variance-authority']),
        );
    });

    it('includes the tailwind toolchain, since components are class-driven', () => {
        const pkg = JSON.parse(build()['package.json']) as {
            devDependencies: Record<string, string>;
        };
        expect(Object.keys(pkg.devDependencies)).toEqual(
            expect.arrayContaining(['tailwindcss', 'postcss', '@tailwindcss/postcss']),
        );
    });

    it('includes Angular itself', () => {
        const pkg = JSON.parse(build()['package.json']) as {
            dependencies: Record<string, string>;
        };
        expect(pkg.dependencies['@angular/core']).toBeTruthy();
    });

    it("adds the closure's own npm dependencies", () => {
        const withExtra = buildProject({
            ...INPUT,
            closure: { ...CLOSURE, npmDependencies: ['some-chart-lib'] },
        });
        const pkg = JSON.parse(withExtra?.files['package.json'] ?? '{}') as {
            dependencies: Record<string, string>;
        };
        expect(pkg.dependencies['some-chart-lib']).toBeTruthy();
    });
});

describe('T-4 the app imports the component the way the CLI installs it', () => {
    it('writes closure sources under the aliased path', () => {
        const files = build();
        expect(files['src/components/ui/button/button.component.ts'])
            .toBe('export class ButtonComponent {}');
        expect(files['src/components/ui/ripple.directive.ts'])
            .toBe('export class RippleDirective {}');
        expect(files['src/components/lib/utils.ts']).toBe('export const cn = () => "";');
    });

    it('reuses the generated importStatement verbatim', () => {
        expect(build()['src/app/app.ts'])
            .toContain("import { ButtonComponent } from '@/components/ui/button';");
    });

    it('declares the imported class in the component imports array', () => {
        expect(build()['src/app/app.ts']).toContain('imports: [ButtonComponent]');
    });

    it('renders the snippet as the app template', () => {
        expect(build()['src/app/app.ts']).toContain('<ui-button>Click me</ui-button>');
    });

    it('maps the @/ alias onto src/ in tsconfig, or the import cannot resolve', () => {
        const tsconfig = JSON.parse(build()['tsconfig.json']) as {
            compilerOptions: { paths: Record<string, string[]> };
        };
        expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['src/*']);
    });
});

describe('T-5 a component with no usable snippet yields no project', () => {
    it('returns null when a skip reason is recorded', () => {
        expect(buildProject({
            ...INPUT,
            doc: { ...INPUT.doc, snippet: null, snippetSkipReason: 'renders nothing on its own' },
        })).toBeNull();
    });

    it('returns null when the snippet is simply absent', () => {
        expect(buildProject({
            ...INPUT,
            doc: { ...INPUT.doc, snippet: null, snippetSkipReason: null },
        })).toBeNull();
    });
});

describe('the project boots as an Angular app', () => {
    it('ships every file the probe proved StackBlitz needs', () => {
        const files = build();
        for (const path of [
            'package.json', 'angular.json', 'tsconfig.json',
            'src/index.html', 'src/main.ts', 'src/styles.css', 'src/app/app.ts',
        ]) {
            expect(Object.keys(files)).toContain(path);
        }
    });

    it('bootstraps zonelessly, matching how the library is built', () => {
        const main = build()['src/main.ts'];
        expect(main).toContain('provideZonelessChangeDetection');
        expect(main).toContain('bootstrapApplication');
    });

    it('wires styles.css into the build so Tailwind classes resolve', () => {
        const angular = JSON.parse(build()['angular.json']) as {
            projects: Record<string, { architect: Record<string, { options: Record<string, unknown> }> }>;
        };
        expect(angular.projects['playground'].architect['build'].options['styles'])
            .toEqual(['src/styles.css']);
    });
});

describe('playgroundStyles rewrites @source for the generated tree', () => {
    it('drops repo-relative @source lines that would resolve to nothing', () => {
        const css = playgroundStyles(INPUT.themeCss);
        expect(css).not.toContain('../../packages');
        expect(css).not.toContain('../src/');
    });

    it('scans the generated project instead', () => {
        expect(playgroundStyles(INPUT.themeCss)).toContain('@source "./**/*.{ts,html}"');
    });

    it('keeps the theme tokens untouched — the components read them', () => {
        expect(playgroundStyles(INPUT.themeCss)).toContain('--primary: oklch(0.205 0 0)');
        expect(playgroundStyles(INPUT.themeCss)).toContain('@import "tailwindcss"');
    });
});

describe('a component with no importable class yields no project', () => {
    it('returns null when importStatement is null', () => {
        // `rich-text-editor/full` is the real case: an aggregate entry that
        // exports no single primary class, so the app has nothing to put in
        // `imports: []`.
        expect(buildProject({ ...INPUT, doc: { ...INPUT.doc, importStatement: null } }))
            .toBeNull();
    });
});

describe('the generated project actually applies Tailwind', () => {
    /**
     * Found by the boot test: without `.postcssrc.json` the build SUCCEEDS and
     * still emits a styles.css, so the app boots and renders — completely
     * unstyled. A green build is not evidence the playground is right.
     */
    it('writes the postcss config that runs the tailwind plugin', () => {
        const rc = JSON.parse(build()['.postcssrc.json']) as {
            plugins: Record<string, unknown>;
        };
        expect(Object.keys(rc.plugins)).toContain('@tailwindcss/postcss');
    });
});
