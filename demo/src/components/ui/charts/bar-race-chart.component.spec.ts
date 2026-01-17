import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarRaceChartComponent } from './bar-race-chart.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChartDataPoint } from './chart.types';

const sampleFrames: ChartDataPoint[][] = [
    [{ name: 'Alice', value: 45 }, { name: 'Bob', value: 30 }, { name: 'Charlie', value: 55 }],
    [{ name: 'Alice', value: 82 }, { name: 'Bob', value: 68 }, { name: 'Charlie', value: 71 }],
    [{ name: 'Alice', value: 120 }, { name: 'Bob', value: 145 }, { name: 'Charlie', value: 98 }],
];

const frameLabels = ['Week 1', 'Week 2', 'Week 3'];

describe('BarRaceChartComponent', () => {
    let component: BarRaceChartComponent;
    let fixture: ComponentFixture<BarRaceChartComponent>;

    beforeEach(async () => {
        vi.useFakeTimers();

        await TestBed.configureTestingModule({
            imports: [BarRaceChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BarRaceChartComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should create', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should render SVG element', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeTruthy();
    });

    it('should display current frame label', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        expect(component.currentFrameLabel()).toBe('Week 1');
    });

    it('should render bars for current frame', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.componentRef.setInput('maxBars', 3);
        fixture.detectChanges();

        const rects = fixture.debugElement.queryAll(By.css('rect'));
        expect(rects.length).toBe(3);
    });

    it('should limit bars to maxBars', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.componentRef.setInput('maxBars', 2);
        fixture.detectChanges();

        const displayBars = component.displayBars();
        expect(displayBars.length).toBe(2);
    });

    it('should sort bars by value descending', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        const displayBars = component.displayBars();
        // First frame: Charlie (55) > Alice (45) > Bob (30)
        expect(displayBars[0].name).toBe('Charlie');
        expect(displayBars[1].name).toBe('Alice');
        expect(displayBars[2].name).toBe('Bob');
    });

    it('should not be playing initially', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        expect(component.isPlaying()).toBe(false);
    });

    it('should start playing when play is called', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        component.play();
        expect(component.isPlaying()).toBe(true);
    });

    it('should stop playing when pause is called', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        component.play();
        expect(component.isPlaying()).toBe(true);

        component.pause();
        expect(component.isPlaying()).toBe(false);
    });

    it('should go to specific frame', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        const frameChangeSpy = vi.spyOn(component.frameChange, 'emit');
        component.goToFrame(1);

        expect(component.currentFrameIndex()).toBe(1);
        expect(frameChangeSpy).toHaveBeenCalledWith(1);
    });

    it('should clamp frame index to valid range', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        component.goToFrame(10);
        expect(component.currentFrameIndex()).toBe(2); // Last frame

        component.goToFrame(-5);
        expect(component.currentFrameIndex()).toBe(0); // First frame
    });

    it('should have play/pause button', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        const playButton = fixture.debugElement.query(By.css('button'));
        expect(playButton).toBeTruthy();
    });

    it('should have timeline slider', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        const slider = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(slider).toBeTruthy();
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[role="img"]'));
        expect(container).toBeTruthy();
    });

    it('should assign persistent colors to items', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.detectChanges();

        const bars1 = component.displayBars();
        const aliceColor1 = bars1.find(b => b.name === 'Alice')?.color;

        // Go to next frame
        component.goToFrame(1);
        fixture.detectChanges();

        const bars2 = component.displayBars();
        const aliceColor2 = bars2.find(b => b.name === 'Alice')?.color;

        // Color should be the same across frames
        expect(aliceColor1).toBe(aliceColor2);
    });

    it('should have correct dimensions', () => {
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.componentRef.setInput('frameLabels', frameLabels);
        fixture.componentRef.setInput('width', 700);
        fixture.componentRef.setInput('height', 450);
        fixture.detectChanges();

        // Select the main chart SVG (the one with role="img")
        const svg = fixture.debugElement.query(By.css('svg[role="img"]'));
        expect(svg.nativeElement.getAttribute('width')).toBe('700');
        expect(svg.nativeElement.getAttribute('height')).toBe('450');
    });
});
