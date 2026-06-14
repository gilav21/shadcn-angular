import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class ResizeObserver {
		observe(): void { /* no-op test stub */ }
		unobserve(): void { /* no-op test stub */ }
		disconnect(): void { /* no-op test stub */ }
	};
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
	globalThis.IntersectionObserver = class IntersectionObserver {
		readonly root = null;
		readonly rootMargin = '0px';
		readonly thresholds = [0];
		observe(): void { /* no-op test stub */ }
		unobserve(): void { /* no-op test stub */ }
		disconnect(): void { /* no-op test stub */ }
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

if (typeof Element.prototype.scrollIntoView === 'undefined') {
	Element.prototype.scrollIntoView = function () {};
}

if (typeof Element.prototype.getAnimations === 'undefined') {
	Element.prototype.getAnimations = function () {
		return [];
	};
}

if (typeof Element.prototype.animate !== 'function') {
	Element.prototype.animate = function () {
		const animation = {
			onfinish: null as (() => void) | null,
			cancel() {},
			finish() {
				if (this.onfinish) this.onfinish();
			},
		};
		Promise.resolve().then(() => {
			if (animation.onfinish) animation.onfinish();
		});
		return animation as unknown as Animation;
	};
}

if (typeof Range.prototype.getBoundingClientRect !== 'function') {
	Range.prototype.getBoundingClientRect = function () {
		return new DOMRect(0, 0, 0, 0);
	};
}

function isCssIdentifierSafe(codePoint: number): boolean {
	return (
		codePoint >= 0x0080 ||
		codePoint === 0x002d ||
		codePoint === 0x005f ||
		(codePoint >= 0x0030 && codePoint <= 0x0039) ||
		(codePoint >= 0x0041 && codePoint <= 0x005a) ||
		(codePoint >= 0x0061 && codePoint <= 0x007a)
	);
}

function escapeCssCodePoint(
	codePoint: number,
	index: number,
	length: number,
	firstCodePoint: number,
): string {
	if (codePoint === 0) {
		return '�';
	}
	const isDigit = codePoint >= 0x0030 && codePoint <= 0x0039;
	const needsHexEscape =
		(codePoint >= 0x0001 && codePoint <= 0x001f) ||
		codePoint === 0x007f ||
		(index === 0 && isDigit) ||
		(index === 1 && isDigit && firstCodePoint === 0x002d);
	if (needsHexEscape) {
		return `\\${codePoint.toString(16)} `;
	}
	if (index === 0 && length === 1 && codePoint === 0x002d) {
		return String.raw`\-`;
	}
	if (isCssIdentifierSafe(codePoint)) {
		return String.fromCodePoint(codePoint);
	}
	return `\\${String.fromCodePoint(codePoint)}`;
}

function escapeCssIdentifier(value: string): string {
	const chars = Array.from(value);
	const { length } = chars;
	const firstCodePoint = chars[0]?.codePointAt(0) ?? 0;
	let result = '';
	for (const [index, ch] of chars.entries()) {
		result += escapeCssCodePoint(ch.codePointAt(0) ?? 0, index, length, firstCodePoint);
	}
	return result;
}

if (typeof globalThis.CSS === 'undefined') {
	globalThis.CSS = {
		escape: escapeCssIdentifier,
	} as unknown as typeof globalThis.CSS;
}

function computeContentEditable(start: HTMLElement): boolean {
	let node: HTMLElement | null = start;
	while (node) {
		const attr = node.getAttribute('contenteditable');
		const value = attr === null ? 'inherit' : attr.toLowerCase();
		if (value === '' || value === 'true' || value === 'plaintext-only') {
			return true;
		}
		if (value === 'false') {
			return false;
		}
		node = node.parentElement;
	}
	return false;
}

if (!('isContentEditable' in HTMLElement.prototype)) {
	Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
		configurable: true,
		get(this: HTMLElement): boolean {
			return computeContentEditable(this);
		},
	});
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
