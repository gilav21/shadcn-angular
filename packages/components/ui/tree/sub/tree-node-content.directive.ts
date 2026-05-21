import {
    Directive,
    TemplateRef,
    inject,
} from '@angular/core';

@Directive({
    selector: '[uiTreeNodeContent]',
})
export class TreeNodeContentDirective {
    readonly templateRef = inject(TemplateRef);
}
