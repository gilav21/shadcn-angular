import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import {
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandItemComponent,
    CommandGroupComponent,
    CommandEmptyComponent,
    CommandSeparatorComponent,
    CommandShortcutComponent,
} from './command.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    template: `
        <ui-command>
            <ui-command-input placeholder="Type a command..." />
            <ui-command-list>
                <ui-command-empty>No results found.</ui-command-empty>
                <ui-command-group heading="Suggestions">
                    <ui-command-item value="calendar">
                        Calendar
                        <ui-command-shortcut>Ctrl+C</ui-command-shortcut>
                    </ui-command-item>
                    <ui-command-item value="search">Search</ui-command-item>
                </ui-command-group>
                <ui-command-separator />
                <ui-command-group heading="Settings">
                    <ui-command-item value="profile">Profile</ui-command-item>
                </ui-command-group>
            </ui-command-list>
        </ui-command>
    `,
    imports: [
        CommandComponent,
        CommandInputComponent,
        CommandListComponent,
        CommandItemComponent,
        CommandGroupComponent,
        CommandEmptyComponent,
        CommandSeparatorComponent,
        CommandShortcutComponent,
    ]
})
class TestHostComponent {}

describe('CommandComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should create CommandComponent', () => {
        const command = fixture.debugElement.query(By.directive(CommandComponent));
        expect(command).toBeTruthy();
    });

    it('should render command container with data-slot', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="command"]'));
        expect(el).toBeTruthy();
    });

    it('should render command input', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="command-input"]'));
        expect(el).toBeTruthy();
    });

    it('should render command list', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="command-list"]'));
        expect(el).toBeTruthy();
    });

    it('should render command items', () => {
        const items = fixture.debugElement.queryAll(By.directive(CommandItemComponent));
        expect(items.length).toBe(3);
    });

    it('should render command groups', () => {
        const groups = fixture.debugElement.queryAll(By.directive(CommandGroupComponent));
        expect(groups.length).toBe(2);
    });

    it('should render command separator', () => {
        const separator = fixture.debugElement.query(By.css('[data-slot="command-separator"]'));
        expect(separator).toBeTruthy();
    });

    it('should render command shortcut', () => {
        const shortcut = fixture.debugElement.query(By.css('[data-slot="command-shortcut"]'));
        expect(shortcut).toBeTruthy();
        expect(shortcut.nativeElement.textContent.trim()).toBe('Ctrl+C');
    });

    it('should have input with correct placeholder', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.placeholder).toBe('Type a command...');
    });
});
