import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SparklesComponent, SparklesButtonComponent } from './sparkles.component';

describe('Sparkles Components', () => {
    describe('SparklesButtonComponent', () => {
        let component: SparklesButtonComponent;
        let fixture: ComponentFixture<SparklesButtonComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [SparklesButtonComponent]
            }).compileComponents();

            fixture = TestBed.createComponent(SparklesButtonComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
        });

        it('should create', () => {
            expect(component).toBeTruthy();
        });

        it('should show sparkles on hover', () => {
            component.startSparkles(); // Simulate hover
            fixture.detectChanges();

            const element = fixture.nativeElement as HTMLElement;
            expect(element.querySelector('ui-sparkles')).toBeTruthy();
        });
    });
});
