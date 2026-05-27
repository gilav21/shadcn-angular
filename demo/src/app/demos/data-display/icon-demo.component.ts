import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  CodeBlockComponent,
  DEFAULT_ICONS,
  IconComponent,
  IconSize,
  InputComponent,
  SOLID_SUPPORTED_ICONS,
  SeparatorComponent,
  SheetComponent,
  SheetContentComponent,
  SheetDescriptionComponent,
  SheetHeaderComponent,
  SheetTitleComponent,
  SliderComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ICON_DEMO_LOCALES } from './icon-demo.locales';

type IconCategory = { readonly label: string; readonly icons: readonly string[] };

const ICON_CATEGORY_ICONS: readonly (readonly string[])[] = [
  ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up-right', 'arrow-down-left', 'arrow-up-left', 'arrow-down-right', 'arrow-big-up', 'arrow-big-down', 'arrow-big-left', 'arrow-big-right', 'arrow-up-down', 'arrow-left-right', 'arrow-up-from-line', 'arrow-down-to-line', 'arrow-left-from-line', 'arrow-right-from-line', 'arrow-up-to-line', 'arrow-down-from-line', 'arrow-left-to-line', 'arrow-right-to-line', 'move-up', 'move-down', 'move-left', 'move-right', 'move-diagonal', 'move-diagonal-2', 'move-horizontal', 'move-vertical', 'move-up-left', 'move-up-right', 'move-down-left', 'move-down-right', 'move-3d', 'move', 'corner-up-left', 'corner-up-right', 'corner-down-left', 'corner-down-right', 'corner-left-down', 'corner-left-up', 'corner-right-down', 'corner-right-up', 'navigation', 'navigation-2', 'navigation-off', 'undo-2', 'redo-2', 'iteration-cw', 'iteration-ccw', 'iteration', 'split', 'merge', 'forward', 'reply'],
  ['chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'chevrons-up', 'chevrons-down', 'chevrons-left', 'chevrons-right', 'chevrons-up-down'],
  ['check', 'x', 'plus', 'minus', 'search', 'filter', 'list-filter', 'sort-asc', 'sort-desc', 'more-horizontal', 'more-vertical', 'ellipsis', 'grip-vertical', 'grip-horizontal', 'undo', 'redo', 'scissors', 'scissors-line-dashed', 'clipboard-paste', 'clipboard-pen', 'clipboard-pen-line', 'clipboard-plus', 'clipboard-type', 'clipboard-x', 'scan', 'qr-code', 'qr-code-scan', 'nfc', 'grab', 'hand', 'hand-metal', 'hand-platter', 'hand-helping', 'hand-heart', 'handshake', 'expand', 'inspect'],
  ['menu', 'sidebar', 'panel-left', 'panel-right', 'panel-top', 'panel-bottom', 'panel-left-close', 'panel-left-open', 'panel-right-close', 'panel-right-open', 'panel-top-close', 'panel-top-open', 'panel-bottom-close', 'panel-bottom-open', 'external-link', 'copy', 'copy-check', 'copy-plus', 'copy-minus', 'copy-x', 'clipboard', 'clipboard-check', 'clipboard-list', 'clipboard-copy', 'maximize', 'minimize', 'scaling', 'app-window', 'app-window-mac', 'dock', 'ratio', 'picture-in-picture', 'gallery-horizontal', 'gallery-horizontal-end', 'gallery-vertical', 'gallery-vertical-end', 'gallery-thumbnails', 'frame', 'group', 'combine', 'blend'],
  ['circle', 'circle-dot', 'circle-dashed', 'circle-off', 'circle-check', 'circle-x', 'circle-alert', 'circle-plus', 'circle-minus', 'circle-pause', 'circle-play', 'circle-stop', 'circle-arrow-up', 'circle-arrow-down', 'circle-arrow-left', 'circle-arrow-right', 'circle-ellipsis', 'circle-user', 'circle-user-round', 'circle-help', 'octagon-alert'],
  ['square', 'square-dashed', 'square-check', 'square-x', 'square-plus', 'square-minus', 'square-arrow-up-right', 'square-pen', 'sigma-square', 'activity-square'],
  ['badge', 'badge-check', 'badge-info', 'badge-alert', 'badge-x', 'badge-plus', 'badge-minus', 'badge-dollar-sign', 'badge-percent'],
  ['file', 'file-text', 'file-plus', 'file-minus', 'file-check', 'file-x', 'file-search', 'file-lock', 'file-warning', 'file-heart', 'file-pen', 'file-pen-line', 'file-up', 'file-down', 'file-input', 'file-output', 'file-symlink', 'file-code', 'file-json', 'file-terminal', 'file-image', 'file-video', 'file-audio', 'file-archive', 'file-spreadsheet', 'file-type', 'file-badge', 'file-clock', 'file-cog', 'file-diff', 'file-key', 'file-music', 'file-pie-chart', 'file-question', 'file-scan', 'file-sliders', 'file-stack', 'file-volume', 'files'],
  ['folder', 'folder-open', 'folder-open-dot', 'folder-closed', 'folder-plus', 'folder-minus', 'folder-check', 'folder-x', 'folder-up', 'folder-down', 'folder-input', 'folder-output', 'folder-search', 'folder-lock', 'folder-sync', 'folder-heart', 'folder-tree', 'folder-archive', 'folder-clock', 'folder-cog', 'folder-dot', 'folder-git', 'folder-kanban', 'folder-key', 'folder-pen', 'folder-root', 'folder-symlink'],
  ['mail', 'mail-open', 'mail-check', 'mail-x', 'mail-plus', 'mail-minus', 'mail-search', 'mail-warning', 'inbox', 'mailbox', 'paperclip'],
  ['message-square', 'message-square-plus', 'message-square-text', 'message-square-code', 'message-square-dashed', 'message-square-diff', 'message-square-dot', 'message-square-heart', 'message-square-more', 'message-square-off', 'message-square-quote', 'message-square-reply', 'message-square-share', 'message-square-warning', 'message-square-x', 'message-circle', 'message-circle-more', 'message-circle-code', 'message-circle-dashed', 'message-circle-heart', 'message-circle-off', 'message-circle-plus', 'message-circle-question', 'message-circle-reply', 'message-circle-warning', 'message-circle-x', 'messages-square', 'bot-message-square'],
  ['bell', 'bell-ring', 'bell-off', 'bell-plus', 'bell-minus', 'megaphone', 'megaphone-off', 'voicemail', 'send'],
  ['phone', 'phone-call', 'phone-incoming', 'phone-outgoing', 'phone-missed', 'phone-off', 'phone-forwarded', 'at-sign', 'at-sign-2'],
  ['user', 'users', 'user-plus', 'user-minus', 'user-check', 'user-x', 'user-round', 'user-cog', 'user-search', 'user-pen', 'users-round', 'users-2', 'contact', 'contact-round', 'baby', 'person-standing', 'id-card'],
  ['play', 'pause', 'skip-forward', 'skip-back', 'fast-forward', 'rewind', 'volume', 'volume-1', 'volume-2', 'volume-x', 'mic', 'camera', 'video', 'radio', 'radio-tower', 'headphones', 'headset', 'music', 'music-2', 'music-3', 'audio-lines', 'audio-waveform', 'boom-box', 'disc', 'disc-2', 'disc-3', 'disc-album', 'album', 'film', 'clapperboard'],
  ['tv', 'monitor', 'monitor-check', 'monitor-cog', 'monitor-down', 'monitor-off', 'monitor-pause', 'monitor-play', 'monitor-smartphone', 'monitor-stop', 'monitor-up', 'monitor-x', 'smartphone', 'tablet', 'laptop', 'projector', 'screen-share', 'screen-share-off'],
  ['watch', 'mouse', 'keyboard', 'keyboard-music', 'keyboard-off', 'gamepad-2', 'printer-check', 'printer', 'cpu', 'server', 'hard-drive', 'memory-stick', 'hdmi-port', 'ethernet', 'cable', 'plug', 'antenna'],
  ['alert-triangle', 'info', 'ban', 'siren', 'siren-alert', 'hourglass', 'timer', 'timer-off', 'timer-reset', 'alarm-clock', 'gauge', 'infinity', 'history'],
  ['calendar', 'calendar-days', 'calendar-check', 'calendar-x', 'calendar-plus', 'calendar-minus', 'calendar-clock', 'calendar-heart', 'calendar-range', 'calendar-search', 'calendar-cog', 'calendar-fold', 'calendar-off', 'clock', 'clock-1', 'clock-2', 'clock-3', 'clock-4', 'clock-12', 'stopwatch'],
  ['pencil', 'pencil-line', 'pen', 'pen-tool', 'pencil-ruler', 'paintbrush', 'brush', 'highlighter', 'eraser', 'stamp', 'spray-can', 'ruler', 'drafting-compass', 'trash', 'trash-2', 'trash-x', 'wrench', 'wrench-2', 'hammer', 'gavel', 'axe', 'broom', 'drill', 'settings', 'settings-2', 'key', 'key-round', 'key-square', 'bug', 'bug-off', 'bug-play', 'test-tube', 'test-tubes', 'flask', 'flask-conical-off', 'flask-round', 'construction', 'hard-hat', 'cone', 'shovel'],
  ['activity', 'bar-chart', 'bar-chart-2', 'bar-chart-3', 'bar-chart-4', 'line-chart', 'area-chart', 'candlestick-chart', 'scatter-chart', 'chart-no-axes-column', 'chart-no-axes-combined', 'chart-pie', 'chart-spline', 'chart-column-stacked', 'pie-chart', 'trending-up', 'trending-down', 'signal', 'table'],
  ['download', 'upload', 'share', 'share-2', 'link', 'link-2', 'link-2-off', 'unlink', 'cloud-download', 'cloud-upload', 'log-in', 'log-out'],
  ['layout-template', 'layout-dashboard', 'grid-3x3', 'grid-2x2', 'columns-2', 'columns-3', 'rows-2', 'rows-3', 'align-start-vertical', 'align-end-vertical', 'align-start-horizontal', 'align-end-horizontal', 'align-center-vertical', 'align-center-horizontal', 'space-between', 'distribute-vertical', 'distribute-horizontal', 'between-horizontal-start', 'between-horizontal-end', 'fold-horizontal', 'fold-vertical'],
  ['star', 'star-half', 'star-off', 'heart', 'heart-crack', 'heart-handshake', 'heart-off', 'bookmark', 'bookmark-plus', 'bookmark-check', 'bookmark-minus', 'bookmark-x', 'flag', 'box', 'box-select', 'layers', 'triangle', 'hexagon', 'pentagon', 'diamond', 'octagon', 'crown', 'crown-simple', 'gem', 'target', 'crosshair', 'sticker', 'shapes', 'component', 'blocks', 'blocks-2', 'puzzle', 'orbit', 'waypoints', 'network', 'workflow', 'cuboid', 'cylinder', 'sparkle', 'ribbon'],
  ['lock', 'lock-keyhole', 'unlock', 'shield', 'shield-check', 'shield-alert', 'shield-off', 'shield-question', 'eye', 'eye-off', 'eye-closed', 'glasses', 'fingerprint', 'scan-face', 'scan-eye', 'scan-heart', 'binoculars', 'globe-lock', 'earth-lock'],
  ['loader', 'loader-2', 'refresh-cw', 'rotate-cw', 'rotate-ccw', 'repeat', 'repeat-1', 'flip-horizontal', 'flip-vertical'],
  ['sun', 'sun-moon', 'sun-dim', 'sunrise', 'sunset', 'moon', 'moon-star', 'cloud', 'cloud-sun', 'cloud-sun-rain', 'cloud-fog', 'cloud-rain', 'cloud-rain-wind', 'cloud-drizzle', 'cloud-snow', 'cloud-lightning', 'cloud-hail', 'cloud-off', 'cloud-cog', 'cloud-moon', 'cloud-moon-rain', 'rainbow', 'tornado', 'haze', 'zap', 'wind', 'waves', 'thermometer', 'thermometer-sun', 'thermometer-snowflake', 'umbrella', 'umbrella-off', 'snowflake', 'droplet', 'droplets', 'flame', 'flame-kindling', 'leaf', 'sprout', 'mountain', 'tent', 'tent-tree', 'eclipse'],
  ['tree-pine', 'tree-deciduous', 'tree-palm', 'palm-tree', 'flower', 'flower-2', 'clover', 'mushroom', 'vegan', 'wheat', 'hop'],
  ['smile', 'frown', 'thumbs-up', 'thumbs-down', 'ghost', 'worm', 'candy', 'party-popper', 'drama', 'skull'],
  ['bold', 'italic', 'underline', 'strikethrough', 'type', 'heading', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6', 'list', 'list-ordered', 'list-checks', 'list-check', 'list-tree', 'list-collapse', 'list-end', 'list-start', 'list-minus', 'list-plus', 'list-x', 'list-todo', 'list-music', 'list-video', 'list-restart', 'align-left', 'align-center', 'align-right', 'align-justify', 'indent-increase', 'indent-decrease', 'quote', 'subscript', 'superscript', 'spell-check', 'spell-check-2', 'case-upper', 'case-lower', 'wrap-text', 'pilcrow', 'pilcrow-left', 'pilcrow-right', 'text-cursor', 'text-cursor-input', 'text-select', 'whole-word', 'parentheses', 'ligature'],
  ['book', 'book-open', 'book-open-check', 'book-open-text', 'book-marked', 'book-text', 'book-type', 'book-check', 'book-copy', 'book-dashed', 'book-heart', 'book-key', 'book-lock', 'book-minus', 'book-plus', 'book-up', 'book-user', 'book-x', 'book-audio', 'book-headphones', 'notebook', 'notebook-pen', 'notebook-tabs', 'notebook-text', 'newspaper', 'library'],
  ['code', 'code-xml', 'braces', 'brackets', 'regex', 'variable', 'terminal', 'git-branch', 'git-branch-plus', 'git-commit', 'git-commit-vertical', 'git-merge', 'git-pull-request', 'git-pull-request-arrow', 'git-pull-request-closed', 'git-pull-request-create', 'git-pull-request-draft', 'git-compare', 'git-compare-arrows', 'git-fork', 'git-graph', 'webhook', 'container'],
  ['wifi', 'wifi-off', 'bluetooth', 'bluetooth-connected', 'bluetooth-off', 'bluetooth-searching', 'battery', 'battery-charging', 'battery-low', 'globe', 'earth'],
  ['shopping-cart', 'shopping-cart-off', 'shopping-bag', 'shopping-basket', 'receipt', 'receipt-text', 'wallet', 'wallet-cards', 'hand-coins', 'piggy-bank', 'coins', 'banknote', 'credit-card', 'credit-card-off', 'percent', 'package', 'package-check', 'package-open', 'package-plus', 'package-search', 'ticket', 'barcode', 'tag-x', 'tags', 'store-front', 'dollar-sign', 'euro', 'japanese-yen', 'tag', 'hash'],
  ['car', 'car-front', 'car-taxi-front', 'truck', 'bus', 'train', 'bike', 'bike-electric', 'bike-mountain', 'ship', 'sailboat', 'ferry', 'plane', 'plane-takeoff', 'plane-landing', 'fuel', 'ambulance', 'tractor', 'forklift', 'rocket-launch', 'cable-car', 'caravan'],
  ['building', 'building-2', 'church', 'factory', 'landmark', 'hotel', 'warehouse', 'store', 'school', 'hospital', 'castle', 'circus', 'fence', 'dam'],
  ['map', 'map-pin', 'map-pinned', 'milestone', 'signpost', 'route', 'compass', 'locate', 'locate-fixed', 'locate-off', 'parking-meter', 'lasso', 'lasso-select'],
  ['atom', 'beaker', 'microscope', 'dna', 'sigma', 'omega', 'calculator', 'binary', 'pi', 'equal', 'equal-not', 'copyright', 'copyleft', 'creative-commons'],
  ['cat', 'dog', 'bird', 'fish', 'rabbit', 'turtle', 'paw-print', 'bone', 'egg', 'drumstick'],
  ['coffee', 'wine', 'wine-off', 'beer', 'martini', 'cup-soda', 'milk', 'milk-off', 'pizza', 'apple', 'banana', 'cherry', 'citrus', 'grape', 'cake', 'cookie', 'croissant', 'dessert', 'ice-cream', 'ice-cream-bowl', 'ice-cream-cone', 'lollipop', 'popcorn', 'salad', 'sandwich', 'soup', 'ham', 'nut', 'utensils', 'cooking-pot'],
  ['heart-pulse', 'stethoscope', 'stethoscope-alt', 'pill', 'syringe', 'brain', 'brain-circuit', 'brain-cog', 'ambulance-siren', 'band-aid', 'briefcase-medical'],
  ['graduation-cap', 'backpack', 'presentation', 'aperture', 'focus', 'rss', 'podcast'],
  ['trophy', 'gift', 'award', 'medal', 'dumbbell', 'goal', 'tennis-ball', 'dribbble', 'swords', 'footprints', 'dice-1', 'dice-2', 'dice-3', 'dice-4', 'dice-5', 'dice-6', 'joystick', 'gamepad', 'ferris-wheel'],
  ['home', 'sofa', 'bed', 'bed-double', 'bed-single', 'armchair', 'door-open', 'door-closed', 'bath', 'lamp', 'lamp-desk', 'lamp-ceiling', 'lamp-floor', 'lamp-wall-down', 'lamp-wall-up', 'washing-machine', 'microwave', 'blinds', 'heater', 'lightbulb', 'lightbulb-off', 'flashlight', 'flashlight-off', 'fan'],
  ['accessibility', 'ear', 'ear-off', 'wheelchair', 'speech'],
  ['image', 'image-plus', 'image-minus', 'image-down', 'image-up', 'image-off', 'archive', 'archive-x', 'archive-restore', 'save', 'save-all'],
  ['shirt', 'briefcase-business', 'cigarette', 'cigarette-off', 'weight', 'scale', 'magnet'],
  ['drum', 'amphora', 'concierge-bell', 'donut', 'fire-extinguisher', 'life-buoy', 'rocket', 'sparkles', 'wand', 'torch', 'anvil'],
  ['mouse-pointer-click', 'pointer', 'shuffle', 'power', 'palette', 'languages', 'pin', 'anchor', 'telescope', 'brick-wall', 'framer', 'kanban', 'database'],
];

@Component({
  selector: 'app-icon-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    ButtonComponent,
    InputComponent,
    SeparatorComponent,
    SliderComponent,
    SheetComponent,
    SheetContentComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetDescriptionComponent,
    CodeBlockComponent,
  ],
  templateUrl: './icon-demo.component.html',
})
export class IconDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => ICON_DEMO_LOCALES[this.localeId()] ?? ICON_DEMO_LOCALES['en']);

  readonly iconNames = Object.keys(DEFAULT_ICONS);

  readonly iconCategories = computed<ReadonlyArray<IconCategory>>(() => {
    const labels = this.t().categoryLabels;
    return ICON_CATEGORY_ICONS.map((icons, i) => ({ label: labels[i] ?? '', icons }));
  });

  readonly strokeWidthPresets = computed<readonly { label: string; value: number }[]>(() => [
    { label: this.t().strokeLight, value: 1.5 },
    { label: this.t().strokeRegular, value: 2 },
    { label: this.t().strokeThick, value: 2.5 },
  ]);

  readonly iconSearchQuery = signal('');
  readonly selectedIconName = signal<string | null>(null);
  readonly iconExplorerStrokeWidth = signal(2);
  readonly iconExplorerSolid = signal(false);
  readonly iconExplorerSize = signal<IconSize>('lg');
  readonly iconExplorerColor = signal('');
  readonly iconExplorerFillColor = signal('');
  readonly iconSizeOptions: readonly IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  private readonly strokeWidthSliderRef = viewChild<SliderComponent>('strokeWidthSlider');
  private readonly iconSheetRef = viewChild<SheetComponent>('iconSheet');

  readonly filteredIconCategories = computed(() => {
    const query = this.iconSearchQuery().toLowerCase().trim();
    if (!query) return this.iconCategories();
    return this.iconCategories()
      .map(cat => ({
        ...cat,
        icons: cat.icons.filter(icon => icon.includes(query)),
      }))
      .filter(cat => cat.icons.length > 0);
  });

  readonly categorizedIconNames = computed(() => {
    const all = new Set<string>();
    for (const cat of this.iconCategories()) {
      for (const icon of cat.icons) {
        all.add(icon);
      }
    }
    return all;
  });

  readonly uncategorizedFilteredIcons = computed(() => {
    const categorized = this.categorizedIconNames();
    const query = this.iconSearchQuery().toLowerCase().trim();
    return this.iconNames.filter(name =>
      !categorized.has(name) && (!query || name.includes(query))
    );
  });

  readonly selectedIconSupportsSolid = computed(() => {
    const name = this.selectedIconName();
    return name ? SOLID_SUPPORTED_ICONS.has(name) : false;
  });

  readonly iconExplorerCode = computed(() => {
    const name = this.selectedIconName();
    if (!name) return '';
    const parts = [`name="${name}"`];
    const sw = this.iconExplorerStrokeWidth();
    const solid = this.iconExplorerSolid();
    const s = this.iconExplorerSize();
    const c = this.iconExplorerColor();
    const fc = this.iconExplorerFillColor();
    if (solid) parts.push(`weight="solid"`);
    if (!solid && sw !== 2) parts.push(`[strokeWidth]="${sw}"`);
    if (s !== 'md') parts.push(`size="${s}"`);
    if (c) parts.push(`color="${c}"`);
    if (fc) parts.push(`fillColor="${fc}"`);
    return `<ui-icon ${parts.join(' ')} />`;
  });

  selectIcon(name: string): void {
    this.selectedIconName.set(name);
    this.iconExplorerStrokeWidth.set(2);
    this.iconExplorerSolid.set(false);
    this.iconExplorerSize.set('lg');
    this.iconExplorerColor.set('');
    this.iconExplorerFillColor.set('');
    const slider = this.strokeWidthSliderRef();
    if (slider) slider.value.set(2);
    this.iconSheetRef()?.show();
  }

  onStrokeWidthChange(value: number): void {
    this.iconExplorerStrokeWidth.set(Math.round(value * 10) / 10);
  }

  setStrokeWidthPreset(value: number): void {
    this.iconExplorerStrokeWidth.set(value);
    const slider = this.strokeWidthSliderRef();
    if (slider) slider.value.set(value);
  }
}
