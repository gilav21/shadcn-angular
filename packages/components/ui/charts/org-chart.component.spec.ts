import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrgChartComponent } from './org-chart.component';
import { OrgNode } from './chart.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('OrgChartComponent', () => {
    let component: OrgChartComponent;
    let fixture: ComponentFixture<OrgChartComponent>;

    const sampleData: OrgNode[] = [
        { id: '1', name: 'CEO', title: 'Chief Executive Officer', parentId: null },
        { id: '2', name: 'CTO', title: 'Chief Technology Officer', parentId: '1' },
        { id: '3', name: 'CFO', title: 'Chief Financial Officer', parentId: '1' },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OrgChartComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(OrgChartComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should build a tree from data', () => {
        expect(component.tree()).toBeTruthy();
        expect(component.tree()!.node.name).toBe('CEO');
    });

    it('should flatten nodes', () => {
        expect(component.flatNodes().length).toBe(3);
    });

    it('should compute connections between nodes', () => {
        expect(component.connections().length).toBe(2);
    });

    it('should render an SVG element', () => {
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should return initials for a name', () => {
        expect(component.getInitials('John Doe')).toBe('JD');
    });
});
