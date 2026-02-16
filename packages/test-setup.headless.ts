import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver;
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
	globalThis.IntersectionObserver = class IntersectionObserver {
		readonly root = null;
		readonly rootMargin = '0px';
		readonly thresholds = [0];
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords(): IntersectionObserverEntry[] {
			return [];
		}
	} as unknown as typeof globalThis.IntersectionObserver;
}

if (typeof globalThis.PointerEvent === 'undefined') {
	globalThis.PointerEvent = class PointerEvent extends MouseEvent {
		readonly pointerId: number;
		readonly width: number;
		readonly height: number;
		readonly pressure: number;
		readonly tiltX: number;
		readonly tiltY: number;
		readonly pointerType: string;
		readonly isPrimary: boolean;
		constructor(type: string, params: PointerEventInit = {}) {
			super(type, params);
			this.pointerId = params.pointerId ?? 0;
			this.width = params.width ?? 1;
			this.height = params.height ?? 1;
			this.pressure = params.pressure ?? 0;
			this.tiltX = params.tiltX ?? 0;
			this.tiltY = params.tiltY ?? 0;
			this.pointerType = params.pointerType ?? '';
			this.isPrimary = params.isPrimary ?? false;
		}
		getCoalescedEvents(): PointerEvent[] {
			return [];
		}
		getPredictedEvents(): PointerEvent[] {
			return [];
		}
	} as unknown as typeof globalThis.PointerEvent;
}

if (typeof Element.prototype.scrollTo === 'undefined') {
	Element.prototype.scrollTo = function () {};
}

if (typeof Element.prototype.getAnimations === 'undefined') {
	Element.prototype.getAnimations = function () {
		return [];
	};
}

if (typeof HTMLElement.prototype.showPopover === 'undefined') {
	HTMLElement.prototype.showPopover = function () {};
	HTMLElement.prototype.hidePopover = function () {};
	HTMLElement.prototype.togglePopover = function () {
		return false;
	};
}

setupTestBed({
	zoneless: true,
	providers: [],
	browserMode: false,
});
