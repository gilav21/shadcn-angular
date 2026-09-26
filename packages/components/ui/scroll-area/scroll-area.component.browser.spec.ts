import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ScrollAreaComponent } from './scroll-area.component';

/** Browser-only: whether the native scrollbar is hidden is a computed style. */
@Component({
  imports: [ScrollAreaComponent],
  template: `
    <ui-scroll-area class="h-[200px] w-[200px]">
      <div style="height: 900px">Long content</div>
    </ui-scroll-area>
  `,
})
class OverflowingHostComponent {}

describe('ScrollAreaComponent native scrollbar (browser)', () => {
  it('hides the native scrollbar on the viewport so only the custom one shows', async () => {
    await TestBed.configureTestingModule({ imports: [OverflowingHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OverflowingHostComponent);
    fixture.detectChanges();

    const viewport = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    )!;
    expect(getComputedStyle(viewport).scrollbarWidth).toBe('none');
    // A visible native scrollbar would take its width out of the client box.
    expect(viewport.offsetWidth - viewport.clientWidth).toBe(0);
  });
});
