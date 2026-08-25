import type { PlaygroundProject } from './project';

/**
 * StackBlitz's project-creation endpoint.
 *
 * A form POST here creates the project from the body — there is no clone step,
 * which is the whole reason this replaced the `/github/<slug>` import URL that
 * hung on "Cloning repo from GitHub" (see the spec's §1.2).
 */
export const POST_URL = 'https://stackblitz.com/run';

/**
 * Ceiling on the encoded body, above which the POST is refused locally.
 *
 * StackBlitz does not publish a hard number, so this is a conservative bound
 * chosen against measured reality: the median component closure is ~34 KB and
 * only two exceed 1 MB (`rich-text-editor/full` is the largest at ~2.26 MB).
 * 8 MB therefore clears every real closure with room to spare while still
 * failing loudly on something pathological, rather than posting a body the
 * server may reject with an opaque error.
 */
export const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;

/** Encoded size of a project's contents, in bytes. */
export function payloadBytes(project: PlaygroundProject): number {
    const encoder = new TextEncoder();
    let total = 0;
    for (const [path, contents] of Object.entries(project.files)) {
        total += encoder.encode(path).length + encoder.encode(contents).length;
    }
    return total;
}

/**
 * A path is only ever written inside the generated project, so anything that
 * could climb out of it is a generator bug — surfaced here rather than posted.
 */
function assertContained(path: string): void {
    if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
        throw new Error(`Refusing to post an absolute path: "${path}"`);
    }
    if (path.split('/').includes('..')) {
        throw new Error(`Refusing to post a path containing "..": "${path}"`);
    }
}

/**
 * The form fields that create the project.
 *
 * Returns the fields rather than submitting them so the shape is testable
 * without a browser navigation; the caller builds the `<form>`.
 */
export function buildPayload(
    project: PlaygroundProject,
    componentName: string,
): Map<string, string> {
    const size = payloadBytes(project);
    if (size > MAX_PAYLOAD_BYTES) {
        throw new Error(
            `Playground for "${componentName}" is too large to post: ` +
            `${size} bytes against a ${MAX_PAYLOAD_BYTES} byte limit.`,
        );
    }

    const fields = new Map<string, string>();
    for (const [path, contents] of Object.entries(project.files)) {
        assertContained(path);
        fields.set(`project[files][${path}]`, contents);
    }

    fields.set('project[title]', `shadcn-angular — ${componentName}`);
    fields.set(
        'project[description]',
        `A runnable playground for the ${componentName} component.`,
    );
    // The WebContainer template. The legacy EngineBlock templates cannot build
    // Angular 21; `node` is what the §3.1 probe booted with.
    fields.set('project[template]', 'node');

    return fields;
}

/**
 * Submits a payload by creating a throwaway form and posting it.
 *
 * A form POST rather than `fetch`: the response is a page the reader needs to
 * land on, and StackBlitz sets cookies on it. `target` lets the caller open a
 * new tab, so the docs page they came from is never lost.
 */
export function submitPayload(
    fields: ReadonlyMap<string, string>,
    target = '_blank',
): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = POST_URL;
    form.target = target;
    form.style.display = 'none';

    for (const [name, value] of fields) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    form.remove();
}
