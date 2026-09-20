import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** Default key used when persistence is on and no {@link SidebarService.configurePersistence} key is given. */
export const SIDEBAR_STORAGE_KEY = 'ui-sidebar:collapsed';

/**
 * Sidebar Service - Manages sidebar state across components
 */
@Injectable()
export class SidebarService {
  private readonly document = inject(DOCUMENT, { optional: true });

  isOpen = signal(true);
  isCollapsed = signal(false);
  isMobile = signal(false);
  /** Mirrors `SidebarComponent.collapsible`. While `false` the desktop rail never collapses — {@link toggle} leaves it expanded — so labels and tooltips never switch to their collapsed presentation. */
  collapsible = signal(true);

  /**
   * Where the collapsed flag is written, or `null` while persistence is off.
   * Set through {@link configurePersistence}, which the provider calls from its
   * inputs.
   */
  private storageKey: string | null = null;

  /**
   * Turns persistence on or off and seeds {@link isCollapsed} from storage.
   *
   * Called by `ui-sidebar-provider` for its `persistCollapsed` / `storageKey`
   * inputs. Reading happens exactly once, here: later writes are pushed by
   * {@link persist}, so a second sidebar on the same page with its own key
   * never reads another's value.
   *
   * @param key Storage key, or `null` to disable persistence entirely.
   */
  configurePersistence(key: string | null): void {
    this.storageKey = key;
    if (key === null) return;

    const stored = this.readStoredCollapsed(key);
    if (stored !== null) {
      this.isCollapsed.set(stored);
    }
  }

  /** The one action bound to the trigger: on mobile it opens/closes the drawer, on desktop it collapses/expands the rail unless {@link collapsible} is `false`. The two states are independent, so a drawer left open stays open when the viewport grows back to desktop. */
  toggle(): void {
    if (this.isMobile()) {
      this.isOpen.update(v => !v);
      return;
    }
    if (!this.collapsible()) return;
    this.isCollapsed.update(v => !v);
    this.persist();
  }

  /** Collapses or expands the desktop rail and persists the result, without going through {@link toggle}'s mobile branch. */
  setCollapsed(collapsed: boolean): void {
    this.isCollapsed.set(collapsed);
    this.persist();
  }

  /** Opens the drawer. Only observable on mobile — on desktop the sidebar is always rendered and `isCollapsed` is what controls its width. */
  open(): void {
    this.isOpen.set(true);
  }

  /** Closes the drawer (scrim click, Escape, or a nav item's own handler). Focus returns to whatever was focused before it opened. */
  close(): void {
    this.isOpen.set(false);
  }

  /**
   * Switches between drawer and rail behaviour; the provider calls this on every
   * window resize. Entering mobile force-closes the drawer, so crossing the
   * breakpoint always dismisses an open sidebar. Leaving mobile does not reopen
   * it — `isOpen` stays false until something calls {@link open}, which is
   * harmless because desktop ignores it.
   */
  setMobile(isMobile: boolean): void {
    this.isMobile.set(isMobile);
    if (isMobile) {
      this.isOpen.set(false);
    }
  }

  /**
   * Writes the current collapsed flag, if persistence is configured.
   *
   * Every failure mode here is non-fatal by design: a sidebar must render in a
   * private window, with site data blocked, and under SSR. Both the property
   * access and the call can throw — Safari's private mode throws on `setItem`
   * quota, and a blocked-storage policy throws on merely *reading*
   * `window.localStorage` — so the whole thing sits inside one try/catch.
   */
  private persist(): void {
    const key = this.storageKey;
    if (key === null) return;

    try {
      this.document?.defaultView?.localStorage?.setItem(key, String(this.isCollapsed()));
    } catch {
      // Storage unavailable (private window, blocked site data, quota): the
      // preference is simply not remembered, which must never break rendering.
    }
  }

  /** Reads the stored flag, or `null` when absent, unparseable or unreadable. */
  private readStoredCollapsed(key: string): boolean | null {
    let raw: string | null = null;
    try {
      raw = this.document?.defaultView?.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }

    // Anything other than the two values we write is treated as absent rather
    // than coerced, so a stray key from another app cannot collapse the rail.
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  }
}
