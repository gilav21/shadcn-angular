import { DOCUMENT } from '@angular/common';
import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CarouselComponent, CarouselContentComponent, CarouselItemComponent } from './carousel';
import { MeteorsComponent } from './meteors/meteors.component';
import { ResizableHandleComponent, ResizablePanelComponent, ResizablePanelGroupComponent } from './resizable';
import { ScrollProgressComponent } from './scroll-progress/scroll-progress.component';

/**
 * Two rules, for every component that runs DOM code at construct, render or teardown time (all of
 * which run on the server too, where there is no global `document`):
 *   1. it uses the `DOCUMENT` it was given, never the bare global;
 *   2. a feature that only makes sense in a browser does nothing on the server.
 *
 * A bare `document` cannot be told from the injected one while they are the same object, so each
 * test hands the component a different document (or a server platform) and checks the component
 * used it. The overrides are on the one component, so Angular's own rendering is untouched.
 */

const otherDocument = (): Document => document.implementation.createHTMLDocument('another document');

@Component({
    template: `
        <ui-carousel>
            <ui-carousel-content>
                <ui-carousel-item>One</ui-carousel-item>
                <ui-carousel-item>Two</ui-carousel-item>
            </ui-carousel-content>
        </ui-carousel>
    `,
    imports: [CarouselComponent, CarouselContentComponent, CarouselItemComponent],
})
class CarouselHost {}

@Component({
    // No scrolling ancestor, so the component's scroll source is the window.
    template: `<div><ui-scroll-progress /></div>`,
    imports: [ScrollProgressComponent],
})
class ScrollProgressHost {}

@Component({
    template: `<div style="position:relative;width:300px;height:200px"><ui-meteors [count]="5" color="red" /></div>`,
    imports: [MeteorsComponent],
})
class MeteorsHost {}

@Component({
    template: `
        <ui-resizable-panel-group direction="horizontal">
            <ui-resizable-panel [defaultSize]="50">Left</ui-resizable-panel>
            <ui-resizable-handle />
            <ui-resizable-panel [defaultSize]="50">Right</ui-resizable-panel>
        </ui-resizable-panel-group>
    `,
    imports: [ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent],
})
class ResizableHost {}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.style.cursor = '';
});

describe('Carousel', () => {
    it('watches the document it was given for direction changes, not the global one', () => {
        const other = otherDocument();
        const observe = vi.spyOn(MutationObserver.prototype, 'observe');
        TestBed.configureTestingModule({ imports: [CarouselHost] }).overrideComponent(CarouselComponent, {
            add: { providers: [{ provide: DOCUMENT, useValue: other }] },
        });

        TestBed.createComponent(CarouselHost).detectChanges();

        const watched = observe.mock.calls.map(([target]) => target);
        expect(watched).toContain(other.documentElement);
        expect(watched).not.toContain(document.documentElement);
    });

    it('renders where there is no MutationObserver, as on the server', () => {
        vi.stubGlobal('MutationObserver', undefined);
        TestBed.configureTestingModule({ imports: [CarouselHost] });

        const fixture = TestBed.createComponent(CarouselHost);
        expect(() => fixture.detectChanges()).not.toThrow();
        expect(fixture.nativeElement.querySelector('[data-slot="carousel-item"]')).not.toBeNull();
    });
});

describe('ScrollProgress', () => {
    it('does not listen to any scroll on the server', () => {
        const listen = vi.spyOn(window, 'addEventListener');
        TestBed.configureTestingModule({ imports: [ScrollProgressHost] }).overrideComponent(ScrollProgressComponent, {
            add: { providers: [{ provide: PLATFORM_ID, useValue: 'server' }] },
        });

        const fixture = TestBed.createComponent(ScrollProgressHost);
        expect(() => fixture.detectChanges()).not.toThrow();

        expect(listen.mock.calls.filter(([type]) => type === 'scroll')).toEqual([]);
    });
});

describe('Meteors', () => {
    it('draws nothing on the server', () => {
        TestBed.configureTestingModule({ imports: [MeteorsHost] }).overrideComponent(MeteorsComponent, {
            add: { providers: [{ provide: PLATFORM_ID, useValue: 'server' }] },
        });

        const fixture = TestBed.createComponent(MeteorsHost);
        expect(() => fixture.detectChanges()).not.toThrow();

        expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
    });

    it('resolves a custom colour in the document it was given', () => {
        const other = otherDocument();
        const create = vi.spyOn(other, 'createElement');
        TestBed.configureTestingModule({ imports: [MeteorsHost] }).overrideComponent(MeteorsComponent, {
            add: { providers: [{ provide: DOCUMENT, useValue: other }] },
        });

        TestBed.createComponent(MeteorsHost).detectChanges();

        // A non-default colour is measured on a throwaway element in the component's own document.
        expect(create).toHaveBeenCalledWith('div');
    });
});

describe('ResizableHandle', () => {
    it('clears the cursor and text selection it set on the body of the document it was given when it is destroyed', () => {
        const other = otherDocument();
        other.body.style.cursor = 'col-resize';
        other.body.style.userSelect = 'none';
        document.body.style.cursor = 'wait';
        TestBed.configureTestingModule({ imports: [ResizableHost] }).overrideComponent(ResizableHandleComponent, {
            add: { providers: [{ provide: DOCUMENT, useValue: other }] },
        });

        const fixture = TestBed.createComponent(ResizableHost);
        fixture.detectChanges();
        fixture.destroy();

        expect(other.body.style.cursor).toBe('');
        expect(other.body.style.userSelect).toBe('');
        // The global body is not this component's to touch.
        expect(document.body.style.cursor).toBe('wait');
    });
});
