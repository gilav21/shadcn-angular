import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarRaceChartComponent } from './bar-race-chart.component';
import { ChartDataPoint } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BarRaceChartComponent', () => {
    let component: BarRaceChartComponent;
    let fixture: ComponentFixture<BarRaceChartComponent>;

    const sampleFrames: ChartDataPoint[][] = [
        [
            { name: 'Item A', value: 10 },
            { name: 'Item B', value: 20 },
        ],
        [
            { name: 'Item A', value: 25 },
            { name: 'Item B', value: 15 },
        ],
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BarRaceChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BarRaceChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should start at frame index 0', () => {
        expect(component.currentFrameIndex()).toBe(0);
    });

    it('should not be playing initially', () => {
        expect(component.isPlaying()).toBe(false);
    });

    it('should compute display bars from current frame', () => {
        expect(component.displayBars().length).toBe(2);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });
});
