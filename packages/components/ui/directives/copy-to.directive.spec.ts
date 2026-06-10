import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ApplicationRef } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CopyToDirective } from './copy-to.directive';

@Component({
	template: `
		<button [uiCopyTo]="textToCopy" (copied)="onCopied()">
			Copy Text
		</button>
	`,
	imports: [CopyToDirective],
})
class TestHostComponent {
	textToCopy = 'Hello, World!';
	copiedCount = 0;

	onCopied() {
		this.copiedCount++;
	}
}

describe('CopyToDirective', () => {
	let fixture: ComponentFixture<TestHostComponent>;
	let host: TestHostComponent;
	let appRef: ApplicationRef;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHostComponent);
		host = fixture.componentInstance;
		appRef = TestBed.inject(ApplicationRef);
		fixture.detectChanges();
		await fixture.whenStable();

		// Mock clipboard API - use defineProperty to bypass readonly
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: vi.fn((text: string) => Promise.resolve()),
			},
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		// Clean up any remaining indicator elements
		document.body.querySelectorAll('.ui-copy-indicator').forEach((el) => el.remove());
		vi.restoreAllMocks();
	});

	it('should create directive on host element', () => {
		expect(host).toBeTruthy();
		const button = fixture.nativeElement.querySelector('button');
		expect(button).toBeTruthy();
	});

	it('should copy text to clipboard on click', async () => {
		const copyWriteTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
		const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

		button.click();
		await fixture.whenStable();

		expect(copyWriteTextSpy).toHaveBeenCalledWith('Hello, World!');
	});

	it('should emit copied output after successful copy', async () => {
		const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
		const initialCount = host.copiedCount;

		button.click();
		appRef.tick();
		await fixture.whenStable();

		expect(host.copiedCount).toBe(initialCount + 1);
	});

	it('should show indicator element after copy', async () => {
		const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

		expect(document.body.querySelector('.ui-copy-indicator')).toBeNull();

		button.click();
		appRef.tick();
		await fixture.whenStable();

		const indicator = document.body.querySelector('.ui-copy-indicator');
		expect(indicator).toBeTruthy();
		expect(indicator?.textContent).toBe('Copied!');
	});

	it('should remove indicator after timeout', async () => {
		vi.useFakeTimers();
		const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

		button.click();
		appRef.tick();
		await fixture.whenStable();

		expect(document.body.querySelector('.ui-copy-indicator')).toBeTruthy();

		// Fast-forward time by 1500ms
		vi.advanceTimersByTime(1500);

		expect(document.body.querySelector('.ui-copy-indicator')).toBeNull();

		vi.useRealTimers();
	});

	it('should handle empty text gracefully', async () => {
		const copyWriteTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
		const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

		// Create a new component with empty text input
		const emptyFixture = TestBed.createComponent(TestHostComponent);
		emptyFixture.componentInstance.textToCopy = '';
		emptyFixture.detectChanges();

		const emptyButton = emptyFixture.nativeElement.querySelector('button') as HTMLButtonElement;
		emptyButton.click();
		appRef.tick();
		await emptyFixture.whenStable();

		expect(copyWriteTextSpy).toHaveBeenCalledWith('');
	});

	it('should clean up on destroy', async () => {
		const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

		button.click();
		appRef.tick();
		await fixture.whenStable();

		const indicator = document.body.querySelector('.ui-copy-indicator');
		expect(indicator).toBeTruthy();

		fixture.destroy();

		// After destroy, the directive's ngOnDestroy should clean up the indicator
		const indicatorAfterDestroy = document.body.querySelector('.ui-copy-indicator');
		expect(indicatorAfterDestroy).toBeNull();
	});
});
