import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrgChartComponent } from './org-chart.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgNode } from './chart.types';

const sampleData: OrgNode[] = [
    { id: 'ceo', name: 'John CEO', title: 'CEO', parentId: null },
    { id: 'cto', name: 'Jane CTO', title: 'CTO', parentId: 'ceo' },
    { id: 'cfo', name: 'Bob CFO', title: 'CFO', parentId: 'ceo' },
    { id: 'dev1', name: 'Alice Dev', title: 'Developer', parentId: 'cto' },
];

describe('OrgChartComponent', () => {
    let component: OrgChartComponent;
    let fixture: ComponentFixture<OrgChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OrgChartComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(OrgChartComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should render SVG element', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('svg[role="img"]'));
        expect(svg).toBeTruthy();
    });

    it('should build tree from flat data', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const tree = component.tree();
        expect(tree).toBeTruthy();
        expect(tree!.node.id).toBe('ceo');
        expect(tree!.children.length).toBe(2); // CTO and CFO
    });

    it('should flatten nodes correctly', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const flatNodes = component.flatNodes();
        expect(flatNodes.length).toBe(4);
    });

    it('should generate connection paths', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const connections = component.connections();
        // 3 connections: CEO->CTO, CEO->CFO, CTO->Dev1
        expect(connections.length).toBe(3);
    });

    it('should render node cards', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const foreignObjects = fixture.debugElement.queryAll(By.css('foreignObject'));
        expect(foreignObjects.length).toBe(4);
    });

    it('should render connection lines', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const paths = fixture.debugElement.queryAll(By.css('.org-chart-lines path'));
        expect(paths.length).toBe(3);
    });

    it('should emit nodeClick when node is clicked', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const clickSpy = vi.spyOn(component.nodeClick, 'emit');
        const nodeCard = fixture.debugElement.query(By.css('foreignObject div[role="button"]'));
        nodeCard.triggerEventHandler('click', new MouseEvent('click'));

        expect(clickSpy).toHaveBeenCalled();
    });

    it('should have role="img" for accessibility', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        const svg = fixture.debugElement.query(By.css('[role="img"]'));
        expect(svg).toBeTruthy();
    });

    it('should support horizontal layout', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('layout', 'horizontal');
        fixture.detectChanges();

        // Should render without error
        const flatNodes = component.flatNodes();
        expect(flatNodes.length).toBe(4);
    });

    it('should support straight lines', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.componentRef.setInput('lineType', 'straight');
        fixture.detectChanges();

        const connections = component.connections();
        // Straight lines use L commands, not C commands
        expect(connections[0].path).toContain('L');
    });

    it('should get initials from name', () => {
        fixture.componentRef.setInput('data', sampleData);
        fixture.detectChanges();

        expect(component.getInitials('John Doe')).toBe('JD');
        expect(component.getInitials('Alice')).toBe('A');
        expect(component.getInitials('A B C D')).toBe('AB');
    });

    it('should apply custom node colors', () => {
        const coloredData: OrgNode[] = [
            { id: 'root', name: 'Root', parentId: null, color: '#ff0000' },
        ];
        fixture.componentRef.setInput('data', coloredData);
        fixture.detectChanges();

        const flatNodes = component.flatNodes();
        const color = component.getNodeColor(flatNodes[0]);
        expect(color).toBe('#ff0000');
    });
});
