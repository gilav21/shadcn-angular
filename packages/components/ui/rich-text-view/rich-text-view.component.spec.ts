import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RichTextViewComponent } from './rich-text-view.component';
import {
    RICH_TEXT_PROSE_CLASSES,
    RichTextEditorComponent,
    RichTextSanitizerService,
} from '../rich-text-editor';
import {
    RichTextActionsBindDirective,
    type RichTextActionEvent,
} from '../rich-text-editor/addons/actions';

/** True under jsdom, where computed style and geometry are not meaningful. */
const isJsdom = navigator.userAgent.includes('jsdom');

describe('RichTextViewComponent', () => {
    let fixture: ComponentFixture<RichTextViewComponent>;
    let component: RichTextViewComponent;

    /** The rendered content element. */
    const content = (): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-view"]') as HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextViewComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextViewComponent);
        component = fixture.componentInstance;
    });

    // T-20
    it('T-20 renders sanitized HTML in html mode', () => {
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput(
            'value',
            '<p>Hi<script>x()</script></p><img src="x" onerror="alert(1)">',
        );
        fixture.detectChanges();

        const el = content();
        expect(el.querySelector('p')?.textContent).toBe('Hi');
        expect(el.querySelector('script')).toBeNull();
        expect(el.innerHTML).not.toContain('onerror');
        expect(el.querySelector('img')).not.toBeNull();
    });

    it('T-20b drops a javascript: href', () => {
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput('value', '<a href="javascript:alert(1)">x</a>');
        fixture.detectChanges();

        expect(content().querySelector('a')?.getAttribute('href')).toBeNull();
    });

    // T-21
    it('T-21 renders markdown by default', () => {
        fixture.componentRef.setInput('value', '# Title\n\nSome **bold**');
        fixture.detectChanges();

        const el = content();
        expect(el.querySelector('h1')?.textContent).toBe('Title');
        expect(el.querySelector('strong')?.textContent).toBe('bold');
    });

    it('T-21b renders a raw HTML block in markdown mode through the sanitizer, not as live markup', () => {
        // This used to assert the HALF-escaped output -- "</div>" showing as
        // visible text -- with a comment noting that the spec predicted a full,
        // symmetric result and the implementation did not deliver it. That is a
        // defect locked in as the contract. The escape is symmetric now: a
        // matched pair is markup, and nothing dangerous gets through (T-20,
        // T-21c).
        fixture.componentRef.setInput('value', '<div>raw</div>');
        fixture.detectChanges();

        expect(content().textContent).toContain('raw');
        expect(content().textContent).not.toContain('</div>');
        expect(content().querySelector('div')).toBeTruthy();
        expect(content().querySelector('script')).toBeNull();
    });

    it('T-21c a raw script block in markdown mode is stripped', () => {
        fixture.componentRef.setInput('value', 'text\n\n<script>window.pwned = 1</script>');
        fixture.detectChanges();

        expect(content().querySelector('script')).toBeNull();
        expect(content().innerHTML).not.toContain('pwned');
    });

    it('T-22a the prose constant actually covers the document elements it claims to', () => {
        // Without this, T-22 and T-22b are vacuous: they assert both elements
        // carry every class *in* the constant, so deleting an entry — the exact
        // drift the constant exists to prevent — would make them trivially
        // pass. Verified by removing the h1 line, which this test catches and
        // those two do not.
        const flat = RICH_TEXT_PROSE_CLASSES.join(' ');
        for (const selector of [
            '[&_h1]:', '[&_h2]:', '[&_h3]:', '[&_ul]:', '[&_ol]:', '[&_li]:',
            '[&_a]:', '[&_code]:', '[&_pre]:', '[&_img]:', '[&_table]:',
            '[&_td]:', '[&_th]:', '[&_details]:', '[&_summary]:', '[&_hr]:',
            '[&_ul[data-task-list]]:', '[&_li[data-task]]:', '[&_blockquote]:',
        ]) {
            expect(flat, selector).toContain(selector);
        }
        // A blockquote with no rule renders identically to a paragraph: the
        // `> ` input rule and the toolbar button both "worked" in the DOM while
        // the user saw no change at all. The border is what makes it visible.
        expect(flat).toContain('[&_blockquote]:border-s-4');
        expect(flat).toContain('[&_h1]:text-3xl');
        expect(flat).toContain('[&_h1]:font-bold');
    });

    // T-22 (view half)
    it('T-22 the content element carries every prose class and none of the editor-only ones', () => {
        fixture.detectChanges();
        const classList = content().className.split(/\s+/);

        for (const group of RICH_TEXT_PROSE_CLASSES) {
            for (const cls of group.split(/\s+/)) {
                expect(classList).toContain(cls);
            }
        }

        for (const editorOnly of [
            '[&_*]:outline-none',
            '[&_img]:cursor-pointer',
            '[&_td.rte-cell-selected]:bg-primary/15',
            '[&_summary]:outline-none',
            'disabled:cursor-not-allowed',
            'prose',
            'prose-sm',
            'dark:prose-invert',
        ]) {
            expect(classList).not.toContain(editorOnly);
        }
    });

    // T-24
    it('T-24 task checkboxes reflect data-checked, are not focusable and do not toggle', () => {
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput(
            'value',
            '<ul data-task-list>'
            + '<li data-task data-checked="true"><input type="checkbox"><span>done</span></li>'
            + '<li data-task data-checked="false"><input type="checkbox"><span>todo</span></li>'
            + '</ul>',
        );
        fixture.detectChanges();

        const boxes = Array.from(content().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        expect(boxes).toHaveLength(2);
        expect(boxes[0].checked).toBe(true);
        expect(boxes[1].checked).toBe(false);
        expect(boxes[0].tabIndex).toBe(-1);
        // aria-disabled, not aria-readonly (ARIA defines no readonly state for
        // role="checkbox") and not the disabled PROPERTY: a disabled input is skipped
        // by screen-reader form navigation, and a checked task in a published
        // document still has to be perceivable.
        expect(boxes[0].getAttribute('aria-disabled')).toBe('true');
        // Named from the task text: "checkbox, checked, unavailable" with no
        // indication of which task is state without content.
        expect(boxes[0].getAttribute('aria-label')).toBe('done');
        expect(boxes[0].disabled).toBe(false);
        expect(boxes[0].getAttribute('aria-readonly')).toBeNull();

        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        boxes[1].dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(boxes[1].checked).toBe(false);
    });

    // T-25 (class half)
    it('T-25 size sm and lg add the editor text-size classes', () => {
        fixture.componentRef.setInput('size', 'sm');
        fixture.detectChanges();
        expect(content().className.split(/\s+/)).toContain('text-sm');

        fixture.componentRef.setInput('size', 'lg');
        fixture.detectChanges();
        expect(content().className.split(/\s+/)).toContain('text-lg');
    });

    it('T-25b class merges onto the content element', () => {
        fixture.componentRef.setInput('class', 'px-4 custom-thing');
        fixture.detectChanges();

        const classList = content().className.split(/\s+/);
        expect(classList).toContain('px-4');
        expect(classList).toContain('custom-thing');
    });

    it('T-25c dir sets the attribute and, in a real browser, the computed direction', () => {
        fixture.componentRef.setInput('dir', 'rtl');
        fixture.componentRef.setInput('value', 'שלום עולם');
        fixture.detectChanges();

        expect(content().getAttribute('dir')).toBe('rtl');
        if (!isJsdom) {
            expect(getComputedStyle(content()).direction).toBe('rtl');
        }
    });

    it('T-25d an unset dir leaves no attribute, so the page direction is inherited', () => {
        fixture.detectChanges();

        expect(content().hasAttribute('dir')).toBe(false);
    });

    // T-26
    it('T-26 changing value re-renders', () => {
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput('value', '<p>first</p>');
        fixture.detectChanges();
        expect(content().textContent).toBe('first');

        fixture.componentRef.setInput('value', '<p>second</p>');
        fixture.detectChanges();

        expect(content().textContent).toBe('second');
    });

    it('T-26b an empty value renders an empty content element with no placeholder', () => {
        fixture.componentRef.setInput('value', '');
        fixture.detectChanges();

        expect(content().innerHTML).toBe('');
        expect(content().hasAttribute('placeholder')).toBe(false);
    });

    it('T-26c renders a very large value without throwing', () => {
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput('value', `<p>${'a'.repeat(500_000)}</p>`);

        expect(() => fixture.detectChanges()).not.toThrow();
        expect(content().querySelector('p')?.textContent).toHaveLength(500_000);
    });

    it('exposes the component instance for the default mode', () => {
        expect(component.mode()).toBe('markdown');
    });
});

// T-22 (editor half) + T-23
@Component({
    imports: [FormsModule, RichTextEditorComponent, RichTextViewComponent],
    template: `
        <ui-rich-text-editor mode="html" [ngModel]="doc()" />
        <ui-rich-text-view mode="html" [value]="doc()" />
    `,
})
class TypographyHost {
    readonly doc = signal('<h1>Heading</h1><p>Body</p>');
}

describe('RichTextViewComponent — shared typography', () => {
    let fixture: ComponentFixture<TypographyHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TypographyHost],
        }).compileComponents();
        fixture = TestBed.createComponent(TypographyHost);
        fixture.detectChanges();
    });

    const editable = (): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
    const view = (): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-view"]') as HTMLElement;

    it('T-22z both elements actually rendered the document', () => {
        // Guards the fixture itself. T-22b reads only class strings, so it
        // passes even when the editable is empty — which is exactly what
        // happened while this host bound a `[value]` input the editor does not
        // have, leaving T-23 comparing against a null h1 in the browser leg.
        expect(editable().querySelector('h1')?.textContent).toBe('Heading');
        expect(view().querySelector('h1')?.textContent).toBe('Heading');
        expect(editable().querySelector('p')?.textContent).toBe('Body');
        expect(view().querySelector('p')?.textContent).toBe('Body');
    });

    it("T-22b the editor's editable carries every prose class and no prose* class", () => {
        const classList = editable().className.split(/\s+/);

        for (const group of RICH_TEXT_PROSE_CLASSES) {
            for (const cls of group.split(/\s+/)) {
                expect(classList).toContain(cls);
            }
        }
        expect(classList).not.toContain('prose');
        expect(classList).not.toContain('prose-sm');
        expect(classList).not.toContain('dark:prose-invert');
        expect(classList).not.toContain('max-w-none');
    });

    it('T-22c the editable keeps the editor-only chrome the constant excludes', () => {
        // The other half of the extraction. T-22 asserts the view LACKS these;
        // without this, deleting them from `editableClasses` — losing the
        // outline suppression and the image cursor — passes the whole suite.
        const classList = editable().className.split(/\s+/);

        for (const chrome of [
            '[&_*]:outline-none',
            '[&_img]:cursor-pointer',
            // The cell-selection tint is painted as an ::after overlay rather
            // than a background, so it shows over a cell's own inline colour.
            '[&_.rte-cell-selected]:after:bg-primary/20',
            '[&_.rte-cell-selected]:after:absolute',
            '[&_summary]:outline-none',
            'disabled:cursor-not-allowed',
        ]) {
            expect(classList, chrome).toContain(chrome);
        }
    });

    it('T-23 an h1 in the view and in the editor have identical computed typography', (ctx) => {
        // Computed style is meaningless under jsdom: it reports the initial
        // value for every property, so both elements would "match" trivially.
        if (isJsdom) return ctx.skip();

        const editorH1 = editable().querySelector('h1') as HTMLElement;
        const viewH1 = view().querySelector('h1') as HTMLElement;
        expect(editorH1).not.toBeNull();
        expect(viewH1).not.toBeNull();

        const a = getComputedStyle(editorH1);
        const b = getComputedStyle(viewH1);
        expect(b.fontSize).toBe(a.fontSize);
        expect(b.fontWeight).toBe(a.fontWeight);

        const viewP = view().querySelector('p') as HTMLElement;
        expect(Number.parseFloat(b.fontSize)).toBeGreaterThan(
            Number.parseFloat(getComputedStyle(viewP).fontSize),
        );
    });
});

// T-27, T-28
const ACTION_HTML =
    '<p><span data-action-click="open" data-action-click-params=\'{"id":1}\'>Open</span></p>';

@Component({
    imports: [RichTextViewComponent, RichTextActionsBindDirective],
    template: `
        @if (onAncestor()) {
            <article [uiRichTextActions]="handlers">
                <ui-rich-text-view [mode]="mode()" [value]="value()" />
            </article>
        } @else if (bound()) {
            <ui-rich-text-view [mode]="mode()" [value]="value()" [uiRichTextActions]="handlers" />
        } @else {
            <ui-rich-text-view [mode]="mode()" [value]="value()" />
        }
    `,
})
class ActionsHost {
    readonly mode = signal<'html' | 'markdown'>('html');
    readonly value = signal(ACTION_HTML);
    readonly bound = signal(true);
    readonly onAncestor = signal(false);
    readonly seen: RichTextActionEvent[] = [];
    readonly handlers = { open: (event: RichTextActionEvent) => this.seen.push(event) };
}

describe('RichTextViewComponent — actions on a page with no editor', () => {
    let fixture: ComponentFixture<ActionsHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ActionsHost],
        }).compileComponents();
        fixture = TestBed.createComponent(ActionsHost);
    });

    afterEach(() => TestBed.resetTestingModule());

    const actioned = (): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelector('[data-action-click]') as HTMLElement;

    it('T-27 keeps data-action-* through sanitization and delivers the click', () => {
        fixture.detectChanges();

        const el = actioned();
        expect(el).not.toBeNull();
        expect(el.getAttribute('data-action-click')).toBe('open');

        el.click();

        expect(fixture.componentInstance.seen).toHaveLength(1);
        expect(fixture.componentInstance.seen[0]).toMatchObject({
            actionId: 'open',
            params: { id: 1 },
            trigger: 'click',
        });
    });

    it('T-27b works when the directive sits on an ancestor of the view', () => {
        fixture.componentInstance.onAncestor.set(true);
        fixture.detectChanges();

        const el = actioned();
        expect(el).not.toBeNull();

        el.click();

        expect(fixture.componentInstance.seen).toHaveLength(1);
    });

    it('T-27c without the directive the action attributes are stripped', () => {
        fixture.componentInstance.bound.set(false);
        fixture.detectChanges();

        expect(actioned()).toBeNull();
    });

    it('T-28 the same holds in markdown mode with the addon-serialized span', () => {
        fixture.componentInstance.mode.set('markdown');
        fixture.componentInstance.value.set(
            'Click <span data-action-click="open" data-action-click-params=\'{"id":1}\'>Open</span> now',
        );
        fixture.detectChanges();

        const el = actioned();
        expect(el).not.toBeNull();

        el.click();

        expect(fixture.componentInstance.seen).toHaveLength(1);
        expect(fixture.componentInstance.seen[0].params).toEqual({ id: 1 });
    });

    it('T-28b the rules are gone once the directive is destroyed', () => {
        fixture.detectChanges();
        const sanitizer = TestBed.inject(RichTextSanitizerService);
        expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click');

        fixture.destroy();

        expect(sanitizer.sanitize(ACTION_HTML)).not.toContain('data-action-click');
    });
});
