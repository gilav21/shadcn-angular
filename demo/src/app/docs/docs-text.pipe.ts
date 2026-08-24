import { Pipe, PipeTransform } from '@angular/core';

/**
 * Render a JSDoc comment as readable prose.
 *
 * The API descriptions come straight from the source, where the house style is
 * JSDoc: `{@link Something}` for references and backticks for code. Interpolated
 * as-is, a table cell then shows the literal characters — `` `setDisabledState` ``
 * with the quotes visible, and `{@link withSeconds}` in full — which reads as a
 * rendering bug rather than as documentation.
 *
 * This unwraps both to their content. It deliberately does **not** produce HTML:
 * the alternative is `innerHTML` plus a sanitizer, and no table cell here needs
 * markup badly enough to be worth an injection surface.
 */
@Pipe({ name: 'docsText' })
export class DocsTextPipe implements PipeTransform {
    transform(value: string | undefined | null): string {
        if (!value) return '';

        return value
            /*
             * `{@link Target}` and `{@link Target|label}` both reduce to their
             * text. The body is matched in one greedy chunk and split
             * afterwards, and the tag name is not matched with `\s+` before
             * `[^}]*`: whitespace is inside that class too, so the two would
             * backtrack against each other on a long unclosed brace.
             */
            .replaceAll(/\{@link([^}]*)\}/g, (_, body: string) => {
                const [target, label] = body.split('|');
                return (label ?? target).trim();
            })
            .replaceAll('`', '');
    }
}
