import { ElementRef, DestroyRef, WritableSignal, signal } from '@angular/core';
import { createResizeObserver } from './observers';

/**
 * Tracks an element's content-box width via `ResizeObserver`, returning a signal
 * that updates as the element resizes. Returns `null` until the first measure so
 * callers can fall back to a default width.
 *
 * The observer is disconnected automatically when the host component is
 * destroyed. Where `ResizeObserver` is unavailable the width is measured once
 * and stays fixed.
 */
export function observeChartWidth(
  host: ElementRef<HTMLElement>,
  destroyRef: DestroyRef
): WritableSignal<number | null> {
  const width = signal<number | null>(null);
  const el = host.nativeElement;

  width.set(el.clientWidth || null);

  const observer = createResizeObserver((entries) => {
    const measured = Math.round(entries[0]?.contentRect.width ?? el.clientWidth);
    if (measured > 0) {
      width.set(measured);
    }
  });
  observer?.observe(el);
  destroyRef.onDestroy(() => observer?.disconnect());

  return width;
}
