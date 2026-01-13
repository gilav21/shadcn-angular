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
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('avatar');
    });

    it('should apply default classes', () => {
        expect(fixture.nativeElement.className).toContain('flex');
        expect(fixture.nativeElement.className).toContain('h-10');
        expect(fixture.nativeElement.className).toContain('w-10');
        expect(fixture.nativeElement.className).toContain('rounded-full');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'h-12 w-12');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('h-12');
        expect(fixture.nativeElement.className).toContain('w-12');
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
        expect(img.nativeElement.getAttribute('data-slot')).toBe('avatar-image');
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
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('avatar-fallback');
    });

    it('should apply default classes', () => {
        expect(fixture.nativeElement.className).toContain('flex');
        expect(fixture.nativeElement.className).toContain('items-center');
        expect(fixture.nativeElement.className).toContain('justify-center');
        expect(fixture.nativeElement.className).toContain('bg-muted');
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
});
