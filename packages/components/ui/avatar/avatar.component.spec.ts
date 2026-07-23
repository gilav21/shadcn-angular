import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarComponent, AvatarImageComponent, AvatarFallbackComponent } from './avatar.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

// Test host component for integration tests
@Component({
    template: `
        <ui-avatar [class]="avatarClass">
            <ui-avatar-image [src]="imageSrc" [alt]="imageAlt" />
            <ui-avatar-fallback>JD</ui-avatar-fallback>
        </ui-avatar>
    `,
    imports: [AvatarComponent, AvatarImageComponent, AvatarFallbackComponent]
})
class TestHostComponent {
    avatarClass = '';
    imageSrc = 'https://example.com/avatar.jpg';
    imageAlt = 'John Doe';
}

describe('AvatarComponent', () => {
    let component: AvatarComponent;
    let fixture: ComponentFixture<AvatarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AvatarComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AvatarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="avatar"', () => {
        expect(fixture.nativeElement.dataset['slot']).toBe('avatar');
    });

    it('should apply default classes', () => {
        expect(fixture.nativeElement.className).toContain('flex');
        expect(fixture.nativeElement.className).toContain('shrink-0');
        expect(fixture.nativeElement.className).toContain('overflow-hidden');
        expect(fixture.nativeElement.className).toContain('rounded-full');
    });

    it('should size via the scoped data-slot, not utility classes', () => {
        // Density sizing lives in the scoped CSS keyed on data-slot="avatar";
        // height/width utilities must NOT be duplicated in the class string.
        expect(fixture.nativeElement.dataset['slot']).toBe('avatar');
        expect(fixture.nativeElement.className).not.toContain('h-10');
        expect(fixture.nativeElement.className).not.toContain('w-10');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'h-12 w-12');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('h-12');
        expect(fixture.nativeElement.className).toContain('w-12');
    });

    it('should apply skeleton classes when skeleton input is set', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.componentRef.setInput('class', 'my-extra');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('block');
        expect(fixture.nativeElement.className).toContain('shrink-0');
        expect(fixture.nativeElement.className).toContain('my-extra');
        // Skeleton mode drops the non-skeleton avatar utilities.
        expect(fixture.nativeElement.className).not.toContain('overflow-hidden');
    });

    it('should set status to "loaded" on onLoad()', () => {
        expect(component.status()).toBe('loading');
        component.onLoad();
        expect(component.status()).toBe('loaded');
    });

    it('should set status to "error" on onError()', () => {
        component.onError();
        expect(component.status()).toBe('error');
    });

    it('toString() returns the fallback when set', () => {
        fixture.componentRef.setInput('fallback', 'JD');
        fixture.componentRef.setInput('alt', 'John Doe');
        fixture.detectChanges();
        expect(component.toString()).toBe('JD');
    });

    it('toString() falls back to alt when fallback is empty', () => {
        fixture.componentRef.setInput('fallback', '');
        fixture.componentRef.setInput('alt', 'John Doe');
        fixture.detectChanges();
        expect(component.toString()).toBe('John Doe');
    });

    it('toString() returns empty string when neither fallback nor alt is set', () => {
        expect(component.toString()).toBe('');
    });
});

describe('AvatarImageComponent', () => {
    let component: AvatarImageComponent;
    let fixture: ComponentFixture<AvatarImageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AvatarImageComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AvatarImageComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('src', 'https://example.com/avatar.jpg');
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render an img element with correct src', () => {
        const img = fixture.debugElement.query(By.css('img'));
        expect(img).toBeTruthy();
        expect(img.nativeElement.src).toBe('https://example.com/avatar.jpg');
    });

    it('should set alt attribute', () => {
        fixture.componentRef.setInput('alt', 'User Avatar');
        fixture.detectChanges();

        const img = fixture.debugElement.query(By.css('img'));
        expect(img.nativeElement.alt).toBe('User Avatar');
    });

    it('should have data-slot="avatar-image"', () => {
        const img = fixture.debugElement.query(By.css('img'));
        expect(img.nativeElement.dataset['slot']).toBe('avatar-image');
    });
});

describe('AvatarFallbackComponent', () => {
    let component: AvatarFallbackComponent;
    let fixture: ComponentFixture<AvatarFallbackComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AvatarFallbackComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AvatarFallbackComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="avatar-fallback"', () => {
        const fallback = fixture.debugElement.query(By.css('[data-slot="avatar-fallback"]'));
        expect(fallback.nativeElement.dataset['slot']).toBe('avatar-fallback');
    });

    it('should apply default classes', () => {
        const fallback = fixture.debugElement.query(By.css('[data-slot="avatar-fallback"]'));
        expect(fallback.nativeElement.className).toContain('flex');
        expect(fallback.nativeElement.className).toContain('items-center');
        expect(fallback.nativeElement.className).toContain('justify-center');
        expect(fallback.nativeElement.className).toContain('bg-muted');
    });
});

describe('Avatar Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render avatar with image and fallback', () => {
        const avatar = fixture.debugElement.query(By.directive(AvatarComponent));
        const image = fixture.debugElement.query(By.directive(AvatarImageComponent));
        const fallback = fixture.debugElement.query(By.directive(AvatarFallbackComponent));

        expect(avatar).toBeTruthy();
        expect(image).toBeTruthy();
        expect(fallback).toBeTruthy();
    });

    it('should show fallback and hide image when in loading state', () => {
        const avatarComp = fixture.debugElement.query(By.directive(AvatarComponent)).componentInstance;
        avatarComp.status.set('loading');
        fixture.detectChanges();

        const img = fixture.debugElement.query(By.css('img')).nativeElement;
        const fallback = fixture.debugElement.query(By.css('[data-slot="avatar-fallback"]'));

        expect(img.style.display).toBe('none');
        expect(fallback).toBeTruthy();
    });

    it('should hide fallback and show image when image is loaded', () => {
        const imgDebugEl = fixture.debugElement.query(By.css('img'));

        // Trigger load event on the img element
        imgDebugEl.triggerEventHandler('load', {});
        fixture.detectChanges();

        const img = imgDebugEl.nativeElement;
        const fallback = fixture.debugElement.query(By.css('[data-slot="avatar-fallback"]'));

        expect(img.style.display).toBe('block');
        expect(fallback).toBeNull();
    });

    it('should show fallback and hide image when image fails to load', () => {
        const imgDebugEl = fixture.debugElement.query(By.css('img'));

        // Trigger error event on the img element
        imgDebugEl.triggerEventHandler('error', {});
        fixture.detectChanges();

        const img = imgDebugEl.nativeElement;
        const fallback = fixture.debugElement.query(By.css('[data-slot="avatar-fallback"]'));

        expect(img.style.display).toBe('none');
        expect(fallback).toBeTruthy();
    });
});
