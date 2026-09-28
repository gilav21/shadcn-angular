import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { TreeSelectComponent } from './tree-select.component';
import { TreeNode } from '../tree';

const SAMPLE_NODES: TreeNode[] = [
    {
        key: 'documents',
        label: 'Documents',
        icon: '📁',
        children: [
            {
                key: 'work', label: 'Work', icon: '📂', children: [
                    { key: 'report', label: 'Report.docx', icon: '📄' },
                    { key: 'expenses', label: 'Expenses.xlsx', icon: '📊' }
                ]
            },
            {
                key: 'personal', label: 'Personal', icon: '📂', children: [
                    { key: 'resume', label: 'Resume.pdf', icon: '📄' }
                ]
            }
        ]
    },
    {
        key: 'images',
        label: 'Images',
        icon: '🖼️',
        children: [
            {
                key: 'vacation', label: 'Vacation', children: [
                    { key: 'beach', label: 'Beach.jpg', icon: '📷' },
                    { key: 'mountains', label: 'Mountains.jpg', icon: '📷' }
                ]
            }
        ]
    }
];

@Component({
    template: `
    <div style="overflow: hidden; width: 220px; height: 40px">
        <ui-tree-select [nodes]="nodes" />
    </div>
  `,
    imports: [TreeSelectComponent]
})
class ClippedTreeSelectHostComponent {
    nodes = SAMPLE_NODES;
}

function waitFrames(count: number): Promise<void> {
    return new Promise<void>(resolve => {
        const step = (left: number) => {
            if (left === 0) {
                resolve();
                return;
            }
            requestAnimationFrame(() => step(left - 1));
        };
        step(count);
    });
}

describe('TreeSelect top-layer escape', () => {
    let fixture: ComponentFixture<ClippedTreeSelectHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ClippedTreeSelectHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ClippedTreeSelectHostComponent);
        fixture.detectChanges();
    });

    async function openPanel(): Promise<HTMLElement> {
        const trigger = fixture.debugElement.query(By.css('button[role="combobox"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await waitFrames(6);
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('[data-slot="popover-content"]')
            ?? document.querySelector('[data-slot="popover-content"]');
    }

    it('promotes the tree panel out of an overflow-hidden ancestor', async () => {
        const panel = await openPanel();
        expect(panel).toBeTruthy();
        expect(panel.matches(':popover-open')).toBe(true);
    });

    it('releases the tree panel from the top layer on close', async () => {
        const panel = await openPanel();
        expect(panel.hasAttribute('popover')).toBe(true);

        const treeSelect = fixture.debugElement.query(By.directive(TreeSelectComponent)).componentInstance as TreeSelectComponent;
        treeSelect.isOpen.set(false);
        fixture.detectChanges();
        await waitFrames(2);

        expect(panel.hasAttribute('popover')).toBe(false);
    });
});
