import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RichTextViewComponent } from './rich-text-view.component';
import {
    RICH_TEXT_PROSE_CLASSES,
    RichTextEditorComponent,
    RichTextAllowDirective,
    RichTextSanitizerService,
    type ResourcePolicyDecision,
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
        // The VIEW's sanitizer, not the root one. The view provides its own so
        // its resource policy is per-instance, and with the directive on the
        // view element the rules register there -- TestBed.inject() hands back
        // an untouched root instance, which would make this pass for the wrong
        // reason both before and after destroy.
        const sanitizer = fixture.debugElement
            .query(By.directive(RichTextViewComponent))
            .injector.get(RichTextSanitizerService);
        expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click');

        fixture.destroy();

        expect(sanitizer.sanitize(ACTION_HTML)).not.toContain('data-action-click');
    });
});

describe('RichTextViewComponent — remote resource policy', () => {
    const TRACKER = 'https://tracker.example/p.png';
    const TRUSTED = 'https://cdn.trusted.com/logo.png';

    @Component({
        selector: 'test-two-views',
        standalone: true,
        imports: [RichTextViewComponent],
        template: `
            <ui-rich-text-view
                id="strict"
                [value]="doc"
                [allowedImageHosts]="['cdn.trusted.com']" />
            <ui-rich-text-view id="open" [value]="doc" />
        `,
    })
    class TwoViewsComponent {
        doc = `![a](${TRACKER})`;
    }

    afterEach(() => TestBed.resetTestingModule());

    const imgIn = (fixture: ComponentFixture<unknown>, id: string): HTMLImageElement =>
        (fixture.nativeElement as HTMLElement).querySelector(
            `#${id} img`,
        ) as HTMLImageElement;

    it('T-P1 two views on one page hold independent policies', () => {
        // The reason the services are component-scoped. On a root singleton the
        // second view's empty list would overwrite the first view's, and which
        // one won would depend on render order.
        const fixture = TestBed.createComponent(TwoViewsComponent);
        fixture.detectChanges();

        expect(imgIn(fixture, 'strict').hasAttribute('src')).toBe(false);
        expect(imgIn(fixture, 'strict').getAttribute('data-blocked-src')).toBe(TRACKER);
        expect(imgIn(fixture, 'open').getAttribute('src')).toBe(TRACKER);
    });

    @Component({
        selector: 'test-nested-views',
        standalone: true,
        imports: [RichTextViewComponent, RichTextAllowDirective],
        template: `
            <div [uiRichTextAllow]="{ imageHosts: hosts(), linkSchemes: ['acme-crm'] }">
                <ui-rich-text-view id="inner" [value]="doc" />
            </div>
        `,
    })
    class NestedViewsComponent {
        readonly hosts = signal<readonly string[]>(['cdn.trusted.com']);
        doc = `![a](${TRACKER}) [c](acme-crm://contact/42)`;
    }

    it('T-P2 a view under a wrapper takes its hosts without opting in', () => {
        // A wrapper exists to be inherited; a view that wants its own policy
        // sets one.
        const fixture = TestBed.createComponent(NestedViewsComponent);
        fixture.detectChanges();

        expect(imgIn(fixture, 'inner').hasAttribute('src')).toBe(false);
        expect(imgIn(fixture, 'inner').getAttribute('data-blocked-src')).toBe(TRACKER);
    });

    it('T-P3 the wrapper carries link schemes as well as hosts', () => {
        const fixture = TestBed.createComponent(NestedViewsComponent);
        fixture.detectChanges();

        const a = (fixture.nativeElement as HTMLElement).querySelector('#inner a');
        expect(a?.getAttribute('href')).toBe('acme-crm://contact/42');
    });

    it('T-P4 an inherited policy tracks a change to the ancestor list', () => {
        // The policy is read inside renderedHtml, so it is a dependency of the
        // computed. Set from an effect instead, this memoises on value alone and
        // the image stays blocked forever.
        const fixture = TestBed.createComponent(NestedViewsComponent);
        fixture.detectChanges();
        expect(imgIn(fixture, 'inner').hasAttribute('src')).toBe(false);

        fixture.componentInstance.hosts.set(['cdn.trusted.com', 'tracker.example']);
        fixture.detectChanges();

        expect(imgIn(fixture, 'inner').getAttribute('src')).toBe(TRACKER);
    });

    @Component({
        selector: 'test-own-wins',
        standalone: true,
        imports: [RichTextViewComponent, RichTextAllowDirective],
        template: `
            <div [uiRichTextAllow]="{ imageHosts: ['tracker.example'] }">
                <ui-rich-text-view
                    id="inner"
                    [value]="doc"
                    [allowedImageHosts]="['cdn.trusted.com']" />
            </div>
        `,
    })
    class OwnWinsComponent {
        doc = `![a](${TRACKER}) ![b](${TRUSTED})`;
    }

    it('T-P5 its own list wins over an inherited one, and never merges', () => {
        // A strict view must not widen to a looser ancestor. Both assertions
        // matter: the tracker blocked proves the ancestor list is not applied,
        // and the trusted one allowed proves its own list is -- an
        // implementation that merged the two would pass a check for either
        // alone.
        const fixture = TestBed.createComponent(OwnWinsComponent);
        fixture.detectChanges();

        const imgs = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('#inner img'),
        ) as HTMLImageElement[];
        expect(imgs).toHaveLength(2);
        expect(imgs[0].hasAttribute('src')).toBe(false);
        expect(imgs[1].getAttribute('src')).toBe(TRUSTED);
    });

    it('T-P6 the policy governs HTML mode as well as the markdown default', () => {
        // markdown is the default mode and routes through a different service,
        // so a test in one mode says nothing about the other.
        const fixture = TestBed.createComponent(TwoViewsComponent);
        fixture.componentRef.setInput('doc', '');
        fixture.detectChanges();

        for (const mode of ['markdown', 'html'] as const) {
            const solo = TestBed.createComponent(RichTextViewComponent);
            solo.componentRef.setInput('mode', mode);
            solo.componentRef.setInput('allowedImageHosts', ['cdn.trusted.com']);
            solo.componentRef.setInput(
                'value',
                mode === 'markdown' ? `![a](${TRACKER})` : `<p><img src="${TRACKER}" alt="a"></p>`,
            );
            solo.detectChanges();

            const img = (solo.nativeElement as HTMLElement).querySelector(
                'img',
            ) as HTMLImageElement;
            expect(img, mode).toBeTruthy();
            expect(img.hasAttribute('src'), mode).toBe(false);
            expect(img.getAttribute('data-blocked-src'), mode).toBe(TRACKER);
        }
    });
});

describe('RichTextViewComponent — blocked-image caption and exposure report (fine-comb review)', () => {
    const TRACKER = 'https://tracker.example/p.png';

    @Component({
        selector: 'test-captioned-view',
        standalone: true,
        imports: [RichTextViewComponent],
        template: `
            <ui-rich-text-view
                [value]="doc()"
                [allowedImageHosts]="['cdn.trusted.com']"
                [blockedImageMessage]="message()"
                [locale]="locale()"
                (imageBlocked)="seen.push($event)" />
        `,
    })
    class CaptionedViewComponent {
        readonly doc = signal(`![chart](${TRACKER})`);
        readonly message = signal<string | undefined>(undefined);
        readonly locale = signal<string | undefined>(undefined);
        seen: ResourcePolicyDecision[] = [];
    }

    afterEach(() => TestBed.resetTestingModule());

    const imgOf = (fixture: ComponentFixture<unknown>): HTMLImageElement =>
        (fixture.nativeElement as HTMLElement).querySelector('img') as HTMLImageElement;

    it('captions a blocked image and announces it, like the editor does', () => {
        // The view had no labelling at all: a blocked image rendered as a
        // broken-image glyph while the docs promised the labelled frame, and
        // the blockedImageMessage input was never read.
        const fixture = TestBed.createComponent(CaptionedViewComponent);
        fixture.detectChanges();

        const img = imgOf(fixture);
        expect(img.hasAttribute('src')).toBe(false);
        expect(img.getAttribute('data-blocked-label')).toBe('Image blocked by security policy');
        expect(img.getAttribute('role')).toBe('img');
        expect(img.getAttribute('aria-label')).toContain('chart');
        expect(img.getAttribute('aria-label')).toContain('blocked');
    });

    it('keeps a blocked image with an EMPTY alt presentational', () => {
        // An empty alt declares the image decorative; giving it role="img" and
        // a name is an ARIA conflict (axe: presentation-role-conflict), and the
        // tracking pixel this policy exists for is exactly that shape. It still
        // gets its visible caption; it is just not announced.
        const fixture = TestBed.createComponent(CaptionedViewComponent);
        fixture.componentInstance.doc.set(`![](${TRACKER})`);
        fixture.detectChanges();

        const img = imgOf(fixture);
        expect(img.getAttribute('data-blocked-src')).toBe(TRACKER);
        expect(img.getAttribute('data-blocked-label')).toBe('Image blocked by security policy');
        expect(img.hasAttribute('role')).toBe(false);
        expect(img.hasAttribute('aria-label')).toBe(false);
    });

    it('takes the developer override as text, and the locale otherwise', () => {
        const fixture = TestBed.createComponent(CaptionedViewComponent);
        fixture.componentInstance.message.set('<b>Ask #it-help</b>');
        fixture.detectChanges();
        expect(imgOf(fixture).getAttribute('data-blocked-label')).toBe('<b>Ask #it-help</b>');
        expect((fixture.nativeElement as HTMLElement).querySelectorAll('b')).toHaveLength(0);

        fixture.componentInstance.message.set(undefined);
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        expect(imgOf(fixture).getAttribute('data-blocked-label')).toBe('התמונה נחסמה על ידי מדיניות אבטחה');
    });

    it('reports every remote resource it judged and drains the buffer each render', () => {
        const fixture = TestBed.createComponent(CaptionedViewComponent);
        fixture.detectChanges();

        const seen = fixture.componentInstance.seen;
        expect(seen.filter((d) => d.host === 'tracker.example' && !d.allowed && d.reason === 'blocked'))
            .toHaveLength(1);

        // Twenty re-renders of a live preview must not leave twenty decisions
        // behind in the sanitizer: nothing but the view drains it.
        const sanitizer = fixture.debugElement
            .query(By.directive(RichTextViewComponent))
            .injector.get(RichTextSanitizerService);
        for (let i = 0; i < 20; i++) {
            fixture.componentInstance.doc.set(`![chart ${i}](${TRACKER})`);
            fixture.detectChanges();
        }
        expect(sanitizer.drainResourceDecisions()).toEqual([]);
        expect(seen).toHaveLength(21);
    });
});

/**
 * Syntax highlighting in the published document (issue #133).
 *
 * The language was stored, applied and round-tripped long before anything drew
 * it: `rich-text-markdown.service.ts` writes `data-language` / `language-*` and
 * the sanitizer has always allowed the `token-*` classes. This is the layer on
 * top.
 */
describe('RichTextViewComponent - syntax highlighting', () => {
    let fixture: ComponentFixture<RichTextViewComponent>;

    const content = (): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-view"]') as HTMLElement;

    const render = (value: string, mode: 'markdown' | 'html' = 'markdown'): HTMLElement => {
        fixture.componentRef.setInput('mode', mode);
        fixture.componentRef.setInput('value', value);
        fixture.detectChanges();
        return content();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [RichTextViewComponent] }).compileComponents();
        fixture = TestBed.createComponent(RichTextViewComponent);
    });

    it('colours a fenced block that names a language', () => {
        const code = render('```ts\nconst a = 1;\n```').querySelector('pre > code') as HTMLElement;
        expect(code.querySelector('.token-keyword')?.textContent).toBe('const');
        expect(code.querySelector('.token-number')?.textContent).toBe('1');
    });

    it('shows exactly the code the author wrote', () => {
        const code = render('```ts\nconst a = 1;\nlet b = 2;\n```').querySelector('pre > code') as HTMLElement;
        expect(code.textContent).toBe('const a = 1;\nlet b = 2;');
    });

    it('leaves a fence with no language, or an unknown one, uncoloured', () => {
        // Not a TypeScript fallback: a document is mostly prose, and notes in a
        // bare fence would be given keywords they do not have.
        expect(render('```\nconst a = 1;\n```').querySelectorAll('.token')).toHaveLength(0);
        expect(render('```klingon\nconst a = 1;\n```').querySelectorAll('.token')).toHaveLength(0);
    });

    it('re-renders the colours when the document changes', () => {
        render('```ts\nconst a = 1;\n```');
        const code = render('```python\ndef f(): pass\n```').querySelector('pre > code') as HTMLElement;
        expect(code.querySelector('.token-keyword')?.textContent).toBe('def');
    });

    it('colours an html-mode document the same way', () => {
        const code = render('<pre><code class="language-python">def f(): pass</code></pre>', 'html')
            .querySelector('pre > code') as HTMLElement;
        expect(code.querySelector('.token-keyword')?.textContent).toBe('def');
    });

    it('keeps an image a code block holds', () => {
        // The markdown writer keeps an image in a block by writing the block in
        // its tag form. The highlighter rebuilds a block from its text, so it
        // must refuse this one rather than delete what it cannot redraw.
        const el = render('<pre><code data-language="ts">a<img src="https://e.com/x.png" alt="q">b</code></pre>', 'html');
        expect(el.querySelector('pre img')).not.toBeNull();
    });
});
