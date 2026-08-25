/**
 * Extractor for `packages/components/api-docs.json`.
 *
 * compodoc's `documentation.json` is ~70 MB and is a build artifact, so nothing
 * downstream can depend on it being present. This reduces it to the facts the
 * docs surfaces actually need — selector, exported class name, and the
 * input/output surface with declared types and JSDoc — and that reduction is
 * committed. `llms.txt` (`gen-llms.ts`) and the demo app's generated API tables
 * both read the extract, so both regenerate reproducibly from files in git and
 * a drift check is meaningful.
 *
 * Pure: no IO, no clock, no randomness. Same compodoc input, same bytes out.
 */

/** compodoc's member shape, narrowed to the fields that survive extraction. */
export interface RawMember {
    readonly name: string;
    readonly type?: string;
    readonly defaultValue?: string;
    readonly required?: boolean;
    readonly rawdescription?: string;
    readonly deprecated?: boolean;
    readonly deprecationMessage?: string;
}

/** compodoc's component/directive shape, narrowed the same way. */
export interface RawClass {
    readonly name: string;
    readonly file: string;
    readonly selector?: string;
    readonly inputsClass?: readonly RawMember[];
    readonly outputsClass?: readonly RawMember[];
    readonly methodsClass?: readonly RawMethod[];
    readonly templateData?: string;
    readonly rawdescription?: string;
}

/** One method as compodoc emits it. */
export interface RawMethod {
    readonly name: string;
    readonly args?: readonly {
        readonly name: string;
        readonly type?: string;
        readonly optional?: boolean;
        readonly defaultValue?: string;
    }[];
    readonly returnType?: string;
    readonly rawdescription?: string;
    readonly jsdoctags?: readonly { readonly tagName?: { readonly text?: string } }[];
}

export interface RawDocumentation {
    readonly components?: readonly RawClass[];
    readonly directives?: readonly RawClass[];
}

/** One input or output in the extract. */
export interface ApiMember {
    readonly name: string;
    readonly type: string;
    readonly description: string;
    readonly required?: true;
    readonly default?: string;
    readonly deprecated?: string;
}

/** One argument of a documented method. */
export interface ApiMethodParam {
    readonly name: string;
    readonly type: string;
    readonly optional: boolean;
    readonly default?: string;
}

/** One imperative method a class publishes for consumers to call. */
export interface ApiMethod {
    readonly name: string;
    readonly signature: string;
    readonly returns: string;
    readonly description: string;
    readonly params: readonly ApiMethodParam[];
}

/** One component or directive in the extract. */
export interface ApiClass {
    readonly name: string;
    readonly file: string;
    readonly kind: 'component' | 'directive';
    readonly selector: string;
    readonly description: string;
    /** True when the template contains `<ng-content>` — i.e. it projects children. */
    readonly projectsContent: boolean;
    readonly inputs: readonly ApiMember[];
    readonly outputs: readonly ApiMember[];
    /**
     * Methods the class opts in to publishing, by tagging them `@publicApi`.
     *
     * Opt-in rather than "every public method": 770 methods are public across
     * the library and the overwhelming majority are template plumbing that is
     * public only incidentally — `getPanelId`, `formatAxisValue`, `toString`.
     * Publishing all of them would bury the handful a consumer is actually
     * meant to call, so the decision is made explicitly at the declaration
     * rather than inferred from a modifier keyword.
     */
    readonly methods: readonly ApiMethod[];
}

/** The committed extract: every library class keyed by repo-relative file path. */
export interface ApiDocs {
    /** Bumped whenever the extract's shape changes, so readers can fail loudly. */
    readonly version: 2;
    readonly classes: readonly ApiClass[];
}

const UI_SOURCE_ROOT = 'packages/components/ui/';

/** Collapse compodoc's raw JSDoc into a single trimmed line. */
export function normalizeDescription(raw: string | undefined): string {
    if (!raw) return '';
    return raw
        .replaceAll(/\r?\n/g, ' ')
        .replaceAll(/\s+/g, ' ')
        .trim();
}

const NUMERIC_LITERAL = /^-?\d+(\.\d+)?$/;

/**
 * compodoc omits `type` for a signal input whose type is inferred from its
 * initializer (`class = input('')`), which would publish an API table full of
 * `unknown`. The initializer carries the answer for the common literal cases,
 * so recover the type from it rather than shipping a wrong one.
 */
export function inferType(member: RawMember): string {
    const declared = member.type?.trim();
    if (declared !== undefined && declared !== '') return declared;
    const value = member.defaultValue?.trim() ?? '';
    if (value === 'true' || value === 'false') return 'boolean';
    if (NUMERIC_LITERAL.test(value)) return 'number';
    if (/^(['"`]).*\1$/s.test(value)) return 'string';
    if (value.startsWith('[')) return 'unknown[]';
    return 'unknown';
}

function toMember(member: RawMember): ApiMember {
    const base = {
        name: member.name,
        type: inferType(member),
        description: normalizeDescription(member.rawdescription),
    };
    const hasDefault = member.defaultValue !== undefined
        && member.defaultValue !== ''
        && member.defaultValue !== 'undefined';
    return {
        ...base,
        ...(member.required === true ? { required: true as const } : {}),
        ...(hasDefault ? { default: member.defaultValue } : {}),
        ...(member.deprecated === true
            ? { deprecated: normalizeDescription(member.deprecationMessage) || 'deprecated' }
            : {}),
    };
}

/** The JSDoc tag a method must carry to appear in the API table. */
export const PUBLIC_API_TAG = 'publicApi';

/** Reads a repo-relative source file. Injected so the extractor stays testable. */
export type SourceReader = (file: string) => string;

/** A method declaration: the first identifier followed by `(` or a type parameter. */
const DECLARATION = /^([A-Za-z_$][\w$]*)\s*[(<]/;
const LEADING_MODIFIER = /^(?:public|protected|async|override|static)\s+/;

/**
 * The methods a source file marks `@publicApi`.
 *
 * Read from the source rather than from compodoc, because compodoc drops tags
 * it does not recognise: `jsdoctags` carries only `@param` and friends, and the
 * tag line is stripped from the description too, so the marker cannot survive
 * the round trip. Scanning the file keeps the decision next to the declaration,
 * which is the whole point of an opt-in marker.
 */
export function publicApiMethods(source: string): ReadonlySet<string> {
    const names = new Set<string>();
    for (const block of source.split('/**').slice(1)) {
        const end = block.indexOf('*/');
        if (end === -1) continue;
        if (!block.slice(0, end).includes(`@${PUBLIC_API_TAG}`)) continue;

        const after = block.slice(end + 2).trimStart().replace(LEADING_MODIFIER, '');
        const declared = DECLARATION.exec(after);
        if (declared) names.add(declared[1]);
    }
    return names;
}

function toMethodParam(arg: NonNullable<RawMethod['args']>[number]): ApiMethodParam {
    const hasDefault = arg.defaultValue !== undefined && arg.defaultValue !== '';
    return {
        name: arg.name,
        type: arg.type?.trim() || 'unknown',
        optional: arg.optional === true || hasDefault,
        ...(hasDefault ? { default: arg.defaultValue } : {}),
    };
}

function toMethod(method: RawMethod): ApiMethod {
    const params = [...(method.args ?? [])].map(toMethodParam);
    const rendered = params
        .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
        .join(', ');
    return {
        name: method.name,
        signature: `${method.name}(${rendered})`,
        returns: method.returnType?.trim() || 'void',
        description: normalizeDescription(method.rawdescription),
        params,
    };
}

function byName(a: { name: string }, b: { name: string }): number {
    return a.name.localeCompare(b.name);
}

function toClass(raw: RawClass, kind: 'component' | 'directive', readSource: SourceReader): ApiClass {
    const published = publicApiMethods(readSource(raw.file));
    return {
        name: raw.name,
        file: raw.file,
        kind,
        selector: raw.selector ?? '',
        description: normalizeDescription(raw.rawdescription),
        projectsContent: (raw.templateData ?? '').includes('<ng-content'),
        inputs: [...(raw.inputsClass ?? [])].map(toMember).sort(byName),
        outputs: [...(raw.outputsClass ?? [])].map(toMember).sort(byName),
        methods: [...(raw.methodsClass ?? [])]
            .filter(m => published.has(m.name))
            .map(toMethod)
            .sort(byName),
    };
}

/**
 * Reduce compodoc output to the committed extract. Only classes under
 * `packages/components/ui/` are kept — demo and story classes are not library
 * API. Sorted by file then class name so the output is byte-stable.
 */
export function extractApiDocs(docs: RawDocumentation, readSource: SourceReader): ApiDocs {
    const classes = [
        ...(docs.components ?? []).map(c => toClass(c, 'component', readSource)),
        ...(docs.directives ?? []).map(c => toClass(c, 'directive', readSource)),
    ]
        .filter(c => c.file.startsWith(UI_SOURCE_ROOT))
        .sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
    return { version: 2, classes };
}

/** Serialize the extract exactly as it is committed (stable, newline-terminated). */
export function serializeApiDocs(docs: ApiDocs): string {
    return JSON.stringify(docs, null, 2) + '\n';
}
