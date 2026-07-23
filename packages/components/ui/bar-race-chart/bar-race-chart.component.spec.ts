import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarRaceChartComponent } from './bar-race-chart.component';
import { ChartDataPoint } from '../../lib/chart.types';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

class ResizeObserverStub {
    observe(): void {
        /* no-op */
    }
    unobserve(): void {
        /* no-op */
    }
    disconnect(): void {
        /* no-op */
    }
}

const globalWithStubs = globalThis as unknown as {
    ResizeObserver?: unknown;
};
const savedResizeObserver = globalWithStubs.ResizeObserver;

beforeEach(() => {
    globalWithStubs.ResizeObserver = ResizeObserverStub;
});

afterEach(() => {
    globalWithStubs.ResizeObserver = savedResizeObserver;
});

describe('BarRaceChartComponent', () => {
    let component: BarRaceChartComponent;
    let fixture: ComponentFixture<BarRaceChartComponent>;

    const sampleFrames: ChartDataPoint[][] = [
        [
            { name: 'Item A', value: 10 },
            { name: 'Item B', value: 20 },
            { name: 'Item C', value: 15 },
        ],
        [
            { name: 'Item A', value: 25 },
            { name: 'Item B', value: 15 },
            { name: 'Item C', value: 30 },
        ],
        [
            { name: 'Item A', value: 40 },
            { name: 'Item B', value: 35 },
            { name: 'Item C', value: 20 },
        ],
    ];

    beforeEach(async () => {
        vi.useFakeTimers();

        await TestBed.configureTestingModule({
            imports: [BarRaceChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(BarRaceChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('frames', sampleFrames);
        fixture.detectChanges();

        vi.runAllTimers();
    });

    afterEach(() => {
        component.pause();
        vi.restoreAllMocks();
        vi.useRealTimers();
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
        expect(component.displayBars()).toHaveLength(3);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    describe('displayBars computed', () => {
        it('should sort bars by value in descending order', () => {
            const bars = component.displayBars();
            expect(bars[0].name).toBe('Item B');
            expect(bars[0].value).toBe(20);
            expect(bars[1].name).toBe('Item C');
            expect(bars[1].value).toBe(15);
            expect(bars[2].name).toBe('Item A');
            expect(bars[2].value).toBe(10);
        });

        it('should limit bars to maxBars input', () => {
            fixture.componentRef.setInput('maxBars', 2);
            fixture.detectChanges();

            const bars = component.displayBars();
            expect(bars).toHaveLength(2);
            expect(bars[0].name).toBe('Item B');
            expect(bars[1].name).toBe('Item C');
        });

        it('should assign rank based on sorted position', () => {
            const bars = component.displayBars();
            expect(bars[0].rank).toBe(0);
            expect(bars[1].rank).toBe(1);
            expect(bars[2].rank).toBe(2);
        });

        it('should assign positive widths proportional to values', () => {
            const bars = component.displayBars();
            for (const bar of bars) {
                expect(bar.width).toBeGreaterThan(0);
                expect(bar.animatedWidth).toBeGreaterThan(0);
            }
            expect(bars[0].width).toBeGreaterThan(bars[2].width);
        });

        it('should return empty array for an empty frame', () => {
            fixture.componentRef.setInput('frames', [[]]);
            fixture.detectChanges();

            expect(component.displayBars()).toHaveLength(0);
        });

        it('should update bars when frame changes', () => {
            component.goToFrame(1);

            const bars = component.displayBars();
            expect(bars[0].name).toBe('Item C');
            expect(bars[0].value).toBe(30);
        });
    });

    describe('play', () => {
        it('should set isPlaying to true', () => {
            component.play();

            expect(component.isPlaying()).toBe(true);
        });

        it('should immediately advance to the next frame when play is called', () => {
            expect(component.currentFrameIndex()).toBe(0);

            component.play();

            expect(component.currentFrameIndex()).toBe(1);
        });

        it('should advance to subsequent frames via timers', () => {
            component.play();
            expect(component.currentFrameIndex()).toBe(1);

            vi.advanceTimersByTime(500);
            expect(component.currentFrameIndex()).toBe(2);
        });

        it('should stop playing and emit animationComplete at the last frame without loop', () => {
            const completeEvents: void[] = [];
            component.animationComplete.subscribe(() =>
                completeEvents.push(undefined),
            );

            component.play();
            expect(component.currentFrameIndex()).toBe(1);

            vi.advanceTimersByTime(500);
            expect(component.currentFrameIndex()).toBe(2);

            vi.advanceTimersByTime(500);
            expect(component.isPlaying()).toBe(false);
            expect(completeEvents).toHaveLength(1);
        });

        it('should emit frameChange for each frame advancement', () => {
            const frameEvents: number[] = [];
            component.frameChange.subscribe(idx => frameEvents.push(idx));

            component.play();
            vi.advanceTimersByTime(500);

            expect(frameEvents).toEqual([1, 2]);
        });

        it('should not restart if already playing', () => {
            component.play();
            expect(component.isPlaying()).toBe(true);
            expect(component.currentFrameIndex()).toBe(1);

            component.play();
            expect(component.isPlaying()).toBe(true);
            expect(component.currentFrameIndex()).toBe(1);
        });
    });

    describe('play with loop', () => {
        it('should loop back to frame 0 when reaching the end', () => {
            fixture.componentRef.setInput('loop', true);
            fixture.detectChanges();

            component.play();
            expect(component.currentFrameIndex()).toBe(1);

            vi.advanceTimersByTime(500);
            expect(component.currentFrameIndex()).toBe(2);

            vi.advanceTimersByTime(500);
            expect(component.currentFrameIndex()).toBe(0);
            expect(component.isPlaying()).toBe(true);
        });
    });

    describe('pause', () => {
        it('should set isPlaying to false', () => {
            component.play();
            expect(component.isPlaying()).toBe(true);

            component.pause();
            expect(component.isPlaying()).toBe(false);
        });

        it('should stop frame advancement', () => {
            component.play();
            expect(component.currentFrameIndex()).toBe(1);

            component.pause();
            vi.advanceTimersByTime(1000);
            expect(component.currentFrameIndex()).toBe(1);
        });
    });

    describe('togglePlay', () => {
        it('should start playing when not playing', () => {
            expect(component.isPlaying()).toBe(false);

            component.togglePlay();

            expect(component.isPlaying()).toBe(true);
        });

        it('should pause when currently playing', () => {
            component.play();
            expect(component.isPlaying()).toBe(true);

            component.togglePlay();

            expect(component.isPlaying()).toBe(false);
        });
    });

    describe('reset', () => {
        it('should pause and set currentFrameIndex to 0', () => {
            component.play();
            expect(component.currentFrameIndex()).toBe(1);

            component.reset();

            expect(component.isPlaying()).toBe(false);
            expect(component.currentFrameIndex()).toBe(0);
        });

        it('should emit frameChange with 0', () => {
            component.goToFrame(2);

            const frameEvents: number[] = [];
            component.frameChange.subscribe(idx => frameEvents.push(idx));

            component.reset();

            expect(frameEvents).toContain(0);
        });
    });

    describe('goToFrame', () => {
        it('should set currentFrameIndex to the specified index', () => {
            component.goToFrame(2);
            expect(component.currentFrameIndex()).toBe(2);
        });

        it('should emit frameChange with the new index', () => {
            const frameEvents: number[] = [];
            component.frameChange.subscribe(idx => frameEvents.push(idx));

            component.goToFrame(1);

            expect(frameEvents).toEqual([1]);
        });

        it('should clamp index to 0 if negative', () => {
            component.goToFrame(-5);
            expect(component.currentFrameIndex()).toBe(0);
        });

        it('should clamp index to last frame if too large', () => {
            component.goToFrame(100);
            expect(component.currentFrameIndex()).toBe(2);
        });
    });

    describe('onSliderChange', () => {
        it('should pause playback and go to the specified frame', () => {
            component.play();
            expect(component.isPlaying()).toBe(true);

            const event = {
                target: { value: '2' },
            } as unknown as Event;
            component.onSliderChange(event);

            expect(component.isPlaying()).toBe(false);
            expect(component.currentFrameIndex()).toBe(2);
        });

        it('should emit frameChange when slider changes', () => {
            const frameEvents: number[] = [];
            component.frameChange.subscribe(idx => frameEvents.push(idx));

            const event = {
                target: { value: '1' },
            } as unknown as Event;
            component.onSliderChange(event);

            expect(frameEvents).toEqual([1]);
        });
    });

    describe('currentFrameLabel', () => {
        it('should show default label when no frameLabels provided', () => {
            expect(component.currentFrameLabel()).toBe('Frame 1');
        });

        it('should show frame label from frameLabels input', () => {
            fixture.componentRef.setInput('frameLabels', [
                '2020',
                '2021',
                '2022',
            ]);
            fixture.detectChanges();

            expect(component.currentFrameLabel()).toBe('2020');

            component.goToFrame(1);
            expect(component.currentFrameLabel()).toBe('2021');
        });
    });

    describe('DOM interaction', () => {
        it('should render play/pause button', () => {
            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const playButton = Array.from(buttons).find(
                (btn: unknown) =>
                    (btn as HTMLElement).getAttribute('aria-label') === 'Play',
            ) as HTMLElement | undefined;
            expect(playButton).toBeTruthy();
        });

        it('should render a range slider', () => {
            const slider = fixture.nativeElement.querySelector(
                'input[type="range"]',
            );
            expect(slider).toBeTruthy();
            expect(slider.getAttribute('min')).toBe('0');
            expect(slider.getAttribute('max')).toBe('2');
        });

        it('should render reset button', () => {
            const buttons = fixture.nativeElement.querySelectorAll(
                'button[type="button"]',
            );
            const resetButton = Array.from(buttons).find(
                (btn: unknown) =>
                    (btn as HTMLElement).getAttribute('aria-label') === 'Reset',
            ) as HTMLElement | undefined;
            expect(resetButton).toBeTruthy();
        });
    });

    describe('animationDuration', () => {
        it('should use custom animation duration for frame advancement', () => {
            fixture.componentRef.setInput('animationDuration', 1000);
            fixture.detectChanges();

            component.play();
            expect(component.currentFrameIndex()).toBe(1);

            vi.advanceTimersByTime(500);
            expect(component.currentFrameIndex()).toBe(1);

            vi.advanceTimersByTime(500);
            expect(component.currentFrameIndex()).toBe(2);
        });
    });

    describe('isRtl direction resolution', () => {
        it('resolves isRtl to true when dir="rtl"', () => {
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);

            const bars = component.displayBars();
            const area = component.chartArea();
            expect(bars[0].x).toBeLessThanOrEqual(area.right);
        });

        it('resolves isRtl to false when dir="ltr"', () => {
            fixture.componentRef.setInput('dir', 'ltr');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
        });
    });

    describe('maxValue for an empty frame', () => {
        it('returns the fallback maximum when the frame has no data', () => {
            fixture.componentRef.setInput('frames', [[]]);
            fixture.detectChanges();
            expect(component.maxValue()).toBe(100);
        });
    });

    describe('animateNextFrame guard', () => {
        it('exits early when invoked while not playing', () => {
            expect(component.isPlaying()).toBe(false);
            const internals = component as unknown as {
                animateNextFrame(): void;
            };
            internals.animateNextFrame();
            expect(component.currentFrameIndex()).toBe(0);
            expect(component.isPlaying()).toBe(false);
        });
    });
});

describe('BarRaceChartComponent — autoPlay', () => {
    const frames: ChartDataPoint[][] = [
        [{ name: 'A', value: 1 }],
        [{ name: 'A', value: 2 }],
    ];

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts playing automatically when autoPlay is true', async () => {
        await TestBed.configureTestingModule({
            imports: [BarRaceChartComponent],
        }).compileComponents();

        const fixture = TestBed.createComponent(BarRaceChartComponent);
        const component = fixture.componentInstance;
        fixture.componentRef.setInput('frames', frames);
        fixture.componentRef.setInput('autoPlay', true);
        fixture.detectChanges();

        expect(component.isPlaying()).toBe(false);

        vi.advanceTimersByTime(0);

        expect(component.isPlaying()).toBe(true);
        expect(component.currentFrameIndex()).toBe(1);

        component.pause();
    });
});

describe('BarRaceChartComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [BarRaceChartComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(BarRaceChartComponent);
        fixture.componentRef.setInput('frames', [[{ name: 'A', value: 1 }]]);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults Play/Reset aria-labels to English', async () => {
        const fixture = await setup();
        const buttons = fixture.nativeElement.querySelectorAll('button');
        expect(buttons[0].getAttribute('aria-label')).toBe('Play');
        expect(buttons[1].getAttribute('aria-label')).toBe('Reset');
    });

    it('localises Play/Reset and applies dir="rtl" when locale="he"', async () => {
        const fixture = await setup({ locale: 'he' });
        const root = fixture.nativeElement.querySelector('div');
        expect(root.getAttribute('dir')).toBe('rtl');
        const buttons = fixture.nativeElement.querySelectorAll('button');
        expect(buttons[0].getAttribute('aria-label')).toBe('הפעל');
        expect(buttons[1].getAttribute('aria-label')).toBe('איפוס');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        const buttons = fixture.nativeElement.querySelectorAll('button');
        expect(buttons[0].getAttribute('aria-label')).toBe('Lecture');
        expect(buttons[1].getAttribute('aria-label')).toBe('Réinitialiser');
    });
});
