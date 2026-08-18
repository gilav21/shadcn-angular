import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'highlight'
})
export class HighlightPipe implements PipeTransform {

    /**
     * Returns `value` with every case-insensitive occurrence of `search` wrapped
     * in a `<span>` carrying the highlight background, or `''`/`value` unchanged
     * when either argument is empty. `ui-autocomplete` binds the result through
     * `[innerHTML]`, so the markup renders.
     *
     * It does **not** escape HTML: `<` and `&` in the option label reach the DOM
     * as markup (Angular's sanitiser strips scripts, but formatting still leaks).
     * `search` is also interpolated into a `RegExp` unescaped — an unbalanced
     * `(` or `[` typed into the box throws, and `.`/`*` match as metacharacters.
     * Only feed it labels and queries you control.
     */
    transform(value: string | undefined | null, search: string | null): string {
        if (!value) return '';
        if (!search) return value;

        const pattern = new RegExp(`(${search})`, 'gi');
        return value.replace(pattern, '<span class="bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100">$1</span>');
    }

}
