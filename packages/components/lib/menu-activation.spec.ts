import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activateAsClick, blockDisabledActivation } from './menu-activation';

describe('blockDisabledActivation', () => {
    let item: HTMLElement;
    let icon: HTMLElement;
    let consumerClick: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
        item = document.createElement('div');
        icon = document.createElement('span');
        item.appendChild(icon);
        document.body.appendChild(item);
        consumerClick = vi.fn<() => void>();
    });

    afterEach(() => item.remove());

    // The consumer's listener is registered first: the guard must win by phase, not by order.
    it('keeps a click away from the consumer while disabled, wherever on the item it lands, and lets it through once enabled', () => {
        let disabled = true;
        item.addEventListener('click', consumerClick);
        const dispose = blockDisabledActivation(item, () => disabled);

        item.click();
        icon.click();
        expect(consumerClick).not.toHaveBeenCalled();

        disabled = false;
        item.click();
        expect(consumerClick).toHaveBeenCalledTimes(1);

        dispose();
    });

    it('stops guarding once cleaned up', () => {
        const dispose = blockDisabledActivation(item, () => true);
        item.addEventListener('click', consumerClick);
        dispose();

        item.click();

        expect(consumerClick).toHaveBeenCalledTimes(1);
    });
});

describe('activateAsClick', () => {
    it('clicks the target once and cancels the default action, so Space does not scroll', () => {
        const target = document.createElement('div');
        const onClick = vi.fn<() => void>();
        target.addEventListener('click', onClick);
        const key = new KeyboardEvent('keydown', { key: ' ', cancelable: true });

        activateAsClick(key, target, false);

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(key.defaultPrevented).toBe(true);
    });

    it('clicks nothing for a disabled item but still cancels the default action', () => {
        const target = document.createElement('div');
        const onClick = vi.fn<() => void>();
        target.addEventListener('click', onClick);
        const key = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

        activateAsClick(key, target, true);

        expect(onClick).not.toHaveBeenCalled();
        expect(key.defaultPrevented).toBe(true);
    });
});
