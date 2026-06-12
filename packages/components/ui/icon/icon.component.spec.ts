import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
// eslint-disable-next-line sonarjs/deprecation -- spec intentionally tests the deprecated ICONS alias
import { IconComponent, DEFAULT_ICONS, ICONS, SOLID_SUPPORTED_ICONS } from './icon.component';
import { provideIcons } from './icon.token';

@Component({
    template: `
        <ui-icon name="check" class="custom-icon-class"></ui-icon>
        <ui-icon name="arrow-up"></ui-icon>
        <ui-icon name="nonexistent"></ui-icon>
    `,
    imports: [IconComponent],
})
class TestHostComponent {}

describe('IconComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, IconComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should create', () => {
        const icons = fixture.debugElement.queryAll(By.directive(IconComponent));
        expect(icons.length).toBe(3);
    });

    it('should render SVG element with correct attributes', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeTruthy();
        expect(svg.nativeElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
        expect(svg.nativeElement.getAttribute('viewBox')).toBe('0 0 24 24');
        expect(svg.nativeElement.getAttribute('data-slot')).toBe('icon');
    });

    it('should render SVG content for known icon', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.innerHTML).toContain('path');
    });

    it('should apply correct class based on icon name', () => {
        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        expect(svgs[0].nativeElement.classList.contains('ui-icon')).toBe(true);
        expect(svgs[0].nativeElement.classList.contains('ui-icon-check')).toBe(true);
        expect(svgs[1].nativeElement.classList.contains('ui-icon-arrow-up')).toBe(true);
    });

    it('should apply custom class input', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- baseVal is an empty string when SVG className isn't animated; fall back to the class attribute on that falsy empty string
            svg.nativeElement.className.baseVal || svg.nativeElement.getAttribute('class'),
        ).toContain('custom-icon-class');
    });

    it('should render empty SVG for unknown icon name', () => {
        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        const unknownSvg = svgs[2];
        expect(unknownSvg.nativeElement.classList.contains('ui-icon-nonexistent')).toBe(true);
    });

    it('should export DEFAULT_ICONS constant with expected keys', () => {
        expect(DEFAULT_ICONS['check']).toBeDefined();
        expect(DEFAULT_ICONS['arrow-up']).toBeDefined();
        expect(DEFAULT_ICONS['x']).toBeDefined();
        expect(DEFAULT_ICONS['calendar']).toBeDefined();
    });

    it('should export ICONS as backward-compatible alias', () => {
        // eslint-disable-next-line sonarjs/deprecation -- verifying deprecated export still works
        expect(ICONS).toBe(DEFAULT_ICONS);
    });
});

describe('IconComponent with size input', () => {
    @Component({
        template: `
            <ui-icon name="check" size="sm"></ui-icon>
            <ui-icon name="check" size="lg"></ui-icon>
            <ui-icon name="check" size="40"></ui-icon>
        `,
        imports: [IconComponent],
    })
    class SizeHostComponent {}

    let fixture: ComponentFixture<SizeHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SizeHostComponent, IconComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SizeHostComponent);
        fixture.detectChanges();
    });

    it('should resolve named sizes to pixel values', () => {
        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        expect(svgs[0].nativeElement.getAttribute('width')).toBe('16');
        expect(svgs[0].nativeElement.getAttribute('height')).toBe('16');
        expect(svgs[1].nativeElement.getAttribute('width')).toBe('32');
        expect(svgs[1].nativeElement.getAttribute('height')).toBe('32');
    });

    it('should pass through custom size values', () => {
        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        expect(svgs[2].nativeElement.getAttribute('width')).toBe('40');
        expect(svgs[2].nativeElement.getAttribute('height')).toBe('40');
    });

    it('should default to md size (24)', () => {
        @Component({
            template: `<ui-icon name="check"></ui-icon>`,
            imports: [IconComponent],
        })
        class DefaultSizeComponent {}

        const defaultFixture = TestBed.createComponent(DefaultSizeComponent);
        defaultFixture.detectChanges();

        const svg = defaultFixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.getAttribute('width')).toBe('24');
        expect(svg.nativeElement.getAttribute('height')).toBe('24');
    });
});

describe('IconComponent with custom icons via provideIcons', () => {
    @Component({
        template: `<ui-icon name="my-custom-icon"></ui-icon>`,
        imports: [IconComponent],
    })
    class CustomIconHostComponent {}

    let fixture: ComponentFixture<CustomIconHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CustomIconHostComponent, IconComponent],
            providers: [
                provideIcons({
                    'my-custom-icon': '<path d="M0 0L24 24" />',
                }),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CustomIconHostComponent);
        fixture.detectChanges();
    });

    it('should render custom icon SVG content', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.innerHTML).toContain('M0 0L24 24');
    });

    it('should apply ui-icon class with custom icon name', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.classList.contains('ui-icon-my-custom-icon')).toBe(true);
    });
});

describe('IconComponent custom icons override built-in', () => {
    const customCheckPath = '<circle cx="12" cy="12" r="10" />';

    @Component({
        template: `<ui-icon name="check"></ui-icon>`,
        imports: [IconComponent],
    })
    class OverrideHostComponent {}

    let fixture: ComponentFixture<OverrideHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OverrideHostComponent, IconComponent],
            providers: [
                provideIcons({ check: customCheckPath }),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(OverrideHostComponent);
        fixture.detectChanges();
    });

    it('should use the custom check icon instead of built-in', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.innerHTML).toContain('r="10"');
        expect(svg.nativeElement.innerHTML).not.toContain('M20 6');
    });
});

describe('IconComponent without custom icons provider', () => {
    @Component({
        template: `<ui-icon name="check"></ui-icon>`,
        imports: [IconComponent],
    })
    class NoProviderHostComponent {}

    let fixture: ComponentFixture<NoProviderHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NoProviderHostComponent, IconComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(NoProviderHostComponent);
        fixture.detectChanges();
    });

    it('should work with only built-in icons', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.innerHTML).toContain('path');
    });

    it('should not throw when UI_CUSTOM_ICONS is not provided', () => {
        expect(() => fixture.detectChanges()).not.toThrow();
    });
});

describe('IconComponent weight input', () => {
    @Component({
        template: `
            <ui-icon name="check" weight="light"></ui-icon>
            <ui-icon name="check" weight="regular"></ui-icon>
            <ui-icon name="check" weight="thick"></ui-icon>
            <ui-icon name="heart" weight="solid"></ui-icon>
            <ui-icon name="check"></ui-icon>
        `,
        imports: [IconComponent],
    })
    class WeightHostComponent {}

    let fixture: ComponentFixture<WeightHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [WeightHostComponent, IconComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(WeightHostComponent);
        fixture.detectChanges();
    });

    it('should set stroke-width to 1.5 for light weight', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[0].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('1.5');
        expect(svg.getAttribute('fill')).toBe('none');
        expect(svg.getAttribute('stroke')).toBe('currentColor');
    });

    it('should set stroke-width to 2 for regular weight', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[1].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('2');
        expect(svg.getAttribute('fill')).toBe('none');
        expect(svg.getAttribute('stroke')).toBe('currentColor');
    });

    it('should set stroke-width to 2.5 for thick weight', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[2].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('2.5');
        expect(svg.getAttribute('fill')).toBe('none');
        expect(svg.getAttribute('stroke')).toBe('currentColor');
    });

    it('should set fill to currentColor and stroke to none for solid weight on supported icon', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[3].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('0');
        expect(svg.getAttribute('fill')).toBe('currentColor');
        expect(svg.getAttribute('stroke')).toBe('none');
    });

    it('should default to regular weight', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[4].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('2');
        expect(svg.getAttribute('fill')).toBe('none');
        expect(svg.getAttribute('stroke')).toBe('currentColor');
    });
});

describe('IconComponent solid fallback for unsupported icons', () => {
    @Component({
        template: `
            <ui-icon name="settings" weight="solid"></ui-icon>
            <ui-icon name="external-link" weight="solid"></ui-icon>
        `,
        imports: [IconComponent],
    })
    class SolidFallbackHostComponent {}

    let fixture: ComponentFixture<SolidFallbackHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SolidFallbackHostComponent, IconComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SolidFallbackHostComponent);
        fixture.detectChanges();
    });

    it('should fall back to regular weight for icons not in solid allowlist', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[0].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('2');
        expect(svg.getAttribute('fill')).toBe('none');
        expect(svg.getAttribute('stroke')).toBe('currentColor');
    });

    it('should export SOLID_SUPPORTED_ICONS set', () => {
        expect(SOLID_SUPPORTED_ICONS).toBeInstanceOf(Set);
        expect(SOLID_SUPPORTED_ICONS.has('heart')).toBe(true);
        expect(SOLID_SUPPORTED_ICONS.has('settings')).toBe(false);
    });
});

describe('IconComponent color inputs', () => {
    @Component({
        template: `
            <ui-icon name="check" color="red"></ui-icon>
            <ui-icon name="check" fillColor="blue"></ui-icon>
            <ui-icon name="check" color="red" fillColor="blue"></ui-icon>
            <ui-icon name="heart" weight="solid" color="green"></ui-icon>
        `,
        imports: [IconComponent],
    })
    class ColorHostComponent {}

    let fixture: ComponentFixture<ColorHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ColorHostComponent, IconComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ColorHostComponent);
        fixture.detectChanges();
    });

    it('should apply color as CSS color style', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[0].nativeElement;
        expect(svg.style.color).toBe('red');
    });

    it('should apply fillColor as SVG fill attribute', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[1].nativeElement;
        expect(svg.getAttribute('fill')).toBe('blue');
    });

    it('should apply both color and fillColor independently', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[2].nativeElement;
        expect(svg.style.color).toBe('red');
        expect(svg.getAttribute('fill')).toBe('blue');
    });

    it('should use currentColor fill for solid weight with color input', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[3].nativeElement;
        expect(svg.style.color).toBe('green');
        expect(svg.getAttribute('fill')).toBe('currentColor');
        expect(svg.getAttribute('stroke')).toBe('none');
    });
});

describe('IconComponent strokeWidth input', () => {
    @Component({
        template: `
            <ui-icon name="check" [strokeWidth]="1.2"></ui-icon>
            <ui-icon name="check" [strokeWidth]="3.5"></ui-icon>
            <ui-icon name="check" weight="thick" [strokeWidth]="0.8"></ui-icon>
            <ui-icon name="check"></ui-icon>
        `,
        imports: [IconComponent],
    })
    class StrokeWidthHostComponent {}

    let fixture: ComponentFixture<StrokeWidthHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [StrokeWidthHostComponent, IconComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(StrokeWidthHostComponent);
        fixture.detectChanges();
    });

    it('should use custom strokeWidth when provided', () => {
        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        expect(svgs[0].nativeElement.getAttribute('stroke-width')).toBe('1.2');
        expect(svgs[1].nativeElement.getAttribute('stroke-width')).toBe('3.5');
    });

    it('should override weight-derived strokeWidth', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[2].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should use weight-derived strokeWidth when strokeWidth is not set', () => {
        const svg = fixture.debugElement.queryAll(By.css('svg'))[3].nativeElement;
        expect(svg.getAttribute('stroke-width')).toBe('2');
    });
});
