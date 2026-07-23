import {
	Directive,
	input,
	output,
	inject,
	ElementRef,
	Renderer2,
	NgZone,
	OnDestroy,
} from '@angular/core';
import { type LocaleInput, createLocaleSelector } from '../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../lib/i18n/common.locales';

@Directive({
	selector: '[uiCopyTo]',
	standalone: true,
	host: {
		'(click)': 'onClick()',
	},
})
export class CopyToDirective implements OnDestroy {
	readonly uiCopyTo = input.required<string>();
	readonly locale = input<LocaleInput<CommonLocale>>();
	readonly copied = output<void>();

	private readonly t = createLocaleSelector(this.locale, COMMON_LOCALES);
	private readonly el = inject(ElementRef);
	private readonly renderer = inject(Renderer2);
	private readonly zone = inject(NgZone);

	private indicatorEl: HTMLElement | null = null;
	private timeoutId: ReturnType<typeof setTimeout> | null = null;

	onClick(): void {
		navigator.clipboard.writeText(this.uiCopyTo()).then(() => {
			this.copied.emit();
			this.zone.run(() => this.showIndicator());
		});
	}

	private showIndicator(): void {
		this.clearIndicator();

		const el = this.renderer.createElement('span') as HTMLElement;
		this.renderer.addClass(el, 'ui-copy-indicator');
		const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
		this.renderer.setStyle(el, 'position', 'fixed');
		this.renderer.setStyle(el, 'top', `${rect.top - 30}px`);
		this.renderer.setStyle(el, 'left', `${rect.left + rect.width / 2}px`);
		this.renderer.setStyle(el, 'transform', 'translateX(-50%)');
		this.renderer.setStyle(el, 'background', 'var(--foreground)');
		this.renderer.setStyle(el, 'color', 'var(--background)');
		this.renderer.setStyle(el, 'padding', '2px 8px');
		this.renderer.setStyle(el, 'border-radius', '4px');
		this.renderer.setStyle(el, 'font-size', '12px');
		this.renderer.setStyle(el, 'pointer-events', 'none');
		this.renderer.setStyle(el, 'z-index', '9999');
		this.renderer.setStyle(el, 'white-space', 'nowrap');
		this.renderer.setStyle(el, 'animation', 'fadeIn 0.15s ease-in');
		const text = this.renderer.createText(this.t().copied);
		this.renderer.appendChild(el, text);
		this.renderer.appendChild(document.body, el);
		this.indicatorEl = el;

		this.timeoutId = setTimeout(() => {
			this.clearIndicator();
		}, 1500);
	}

	private clearIndicator(): void {
		if (this.indicatorEl) {
			this.renderer.removeChild(document.body, this.indicatorEl);
			this.indicatorEl = null;
		}
		if (this.timeoutId !== null) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}

	ngOnDestroy(): void {
		this.clearIndicator();
	}
}
