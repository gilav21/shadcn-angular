import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'highlight',
    standalone: true
})
export class HighlightPipe implements PipeTransform {

    transform(value: string | undefined | null, search: string | null): string {
        if (!value) return '';
        if (!search) return value;

        const pattern = new RegExp(`(${search})`, 'gi');
        return value.replace(pattern, '<span class="bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100">$1</span>');
    }

}
