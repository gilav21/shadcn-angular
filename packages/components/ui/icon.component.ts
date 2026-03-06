import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { cn } from '../lib/utils';
import { UI_CUSTOM_ICONS } from './icon.token';

export const DEFAULT_ICONS = {
    // Arrows & Navigation
    'arrow-up': '<path d="m5 12 7-7 7 7" /><path d="M12 19V5" />',
    'arrow-down': '<path d="M12 5v14" /><path d="m19 12-7 7-7-7" />',
    'arrow-left': '<path d="m12 19-7-7 7-7" /><path d="M19 12H5" />',
    'arrow-right': '<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />',
    'arrow-up-right': '<path d="M7 7h10v10" /><path d="M7 17 17 7" />',
    'arrow-down-left': '<path d="M17 7 7 17" /><path d="M17 17H7V7" />',
    'arrow-up-left': '<path d="M7 7h10" /><path d="M17 17 7 7" /><path d="M7 17V7" />',
    'arrow-down-right': '<path d="m7 7 10 10" /><path d="M17 7v10H7" />',
    'move-up': '<path d="M8 6L12 2L16 6" /><path d="M12 2V22" />',
    'move-down': '<path d="M8 18L12 22L16 18" /><path d="M12 2V22" />',
    'move-left': '<path d="M6 8L2 12L6 16" /><path d="M2 12H22" />',
    'move-right': '<path d="M18 8L22 12L18 16" /><path d="M2 12H22" />',

    // Chevrons
    'chevron-up': '<path d="m18 15-6-6-6 6" />',
    'chevron-down': '<path d="m6 9 6 6 6-6" />',
    'chevron-left': '<path d="m15 18-6-6 6-6" />',
    'chevron-right': '<path d="m9 18 6-6-6-6" />',
    'chevrons-up': '<path d="m17 11-5-5-5 5" /><path d="m17 18-5-5-5 5" />',
    'chevrons-down': '<path d="m7 6 5 5 5-5" /><path d="m7 13 5 5 5-5" />',
    'chevrons-left': '<path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />',
    'chevrons-right': '<path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" />',
    'chevrons-up-down': '<path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" />',

    // Actions
    'check': '<path d="M20 6 9 17l-5-5" />',
    'x': '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    'plus': '<path d="M5 12h14" /><path d="M12 5v14" />',
    'minus': '<path d="M5 12h14" />',
    'search': '<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />',
    'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />',
    'list-filter': '<path d="M3 6h18" /><path d="M7 12h10" /><path d="M10 18h4" />',
    'sort-asc': '<path d="m3 8 4-4 4 4" /><path d="M7 4v16" /><path d="M11 12h4" /><path d="M11 16h7" /><path d="M11 20h10" />',
    'sort-desc': '<path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="M11 4h10" /><path d="M11 8h7" /><path d="M11 12h4" />',
    'more-horizontal': '<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />',
    'more-vertical': '<circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />',
    'ellipsis': '<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />',
    'grip-vertical': '<circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" />',
    'grip-horizontal': '<circle cx="12" cy="9" r="1" /><circle cx="19" cy="9" r="1" /><circle cx="5" cy="9" r="1" /><circle cx="12" cy="15" r="1" /><circle cx="19" cy="15" r="1" /><circle cx="5" cy="15" r="1" />',

    // Common UI
    'menu': '<line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />',
    'sidebar': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3.5v17" />',
    'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3.5v17" />',
    'panel-right': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3.5v17" />',
    'panel-top': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 9h17" />',
    'panel-bottom': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 15h17" />',
    'maximize': '<polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" />',
    'minimize': '<polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" x2="21" y1="10" y2="3" /><line x1="3" x2="10" y1="21" y2="14" />',
    'external-link': '<path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />',
    'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    'clipboard': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />',
    'clipboard-check': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" />',

    // File & Document
    'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />',
    'file-plus': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 18v-6" /><path d="M9 15h6" />',
    'folder': '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />',
    'folder-open': '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />',
    'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',

    // Communication
    'mail': '<rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />',
    'send': '<path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />',
    'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />',

    // User & People
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M16 3.128a4 4 0 0 1 0 7.744" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><circle cx="9" cy="7" r="4" />',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />',
    'user-minus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="22" x2="16" y1="11" y2="11" />',
    'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" />',

    // Media & Content
    'play': '<polygon points="6 3 20 12 6 21 6 3" />',
    'pause': '<rect width="4" height="16" x="6" y="4" /><rect width="4" height="16" x="14" y="4" />',
    'volume-2': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />',
    'volume-x': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="22" x2="16" y1="9" y2="15" /><line x1="16" x2="22" y1="9" y2="15" />',
    'mic': '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" />',
    'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />',

    // Status & Feedback
    'alert-circle': '<circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />',
    'info': '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
    'help-circle': '<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />',
    'x-circle': '<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />',
    'circle-off': '<circle cx="12" cy="12" r="10" /><line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />',
    'ban': '<circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" />',
    'circle': '<circle cx="12" cy="12" r="10" />',
    'circle-dot': '<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" />',

    // Edit & Tools
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />',
    'pencil-line': '<path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />',
    'trash': '<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />',
    'trash-2': '<path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />',
    'settings-2': '<path d="M14 17H5" /><path d="M19 7h-9" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />',
    'key': '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />',

    // Data & Content
    'calendar': '<path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3.5 10h17" />',
    'clock': '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />',
    'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2.5" x2="21.5" y1="10" y2="10" />',
    'dollar-sign': '<line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />',
    'tag': '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />',
    'hash': '<line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" />',
    'database': '<ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" />',
    'table': '<path d="M12 3.5v17" /><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 9h17" /><path d="M3.5 15h17" />',

    // Charts & Analytics
    'activity': '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />',
    'bar-chart': '<line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" />',
    'bar-chart-2': '<line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" />',
    'pie-chart': '<path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />',
    'trending-down': '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" />',

    // Transfer & IO
    'download': '<path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" />',
    'upload': '<path d="M12 3v12" /><path d="m17 8-5-5-5 5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />',
    'share': '<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />',
    'share-2': '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" />',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />',
    'unlink': '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" /><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" /><line x1="8" x2="8" y1="2" y2="5" /><line x1="2" x2="5" y1="8" y2="8" /><line x1="16" x2="16" y1="19" y2="22" /><line x1="19" x2="22" y1="16" y2="16" />',

    // Layout & Grid
    'layout-template': '<rect width="18" height="7" x="3" y="3" rx="1" /><rect width="9" height="7" x="3" y="14" rx="1" /><rect width="5" height="7" x="16" y="14" rx="1" />',
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />',
    'grid-3x3': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3.5v17" /><path d="M15 3.5v17" /><path d="M3.5 9h17" /><path d="M3.5 15h17" />',
    'grid-2x2': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 3.5v17" /><path d="M3.5 12h17" />',
    'columns-2': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 3.5v17" />',
    'columns-3': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3.5v17" /><path d="M15 3.5v17" />',
    'rows-2': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 12h17" />',
    'rows-3': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 9h17" /><path d="M3.5 15h17" />',

    // Shapes & Objects
    'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />',
    'box-select': '<path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" />',
    'layers': '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />',
    'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />',
    'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />',
    'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" />',

    // Security
    'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',
    'unlock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />',
    'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" />',
    'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />',
    'eye-off': '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" />',

    // Loading & Progress
    'loader': '<path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />',
    'loader-2': '<path d="M21 12a9 9 0 1 1-6.219-8.56" />',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />',
    'rotate-cw': '<path d="M21 12a9 9 0 1 1-3-6.706L21 8" /><path d="M21 3v5h-5" />',

    // Weather & Nature
    'sun': '<circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />',
    'cloud': '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />',
    'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />',

    // Misc
    'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />',
    'globe': '<circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />',
    'compass': '<circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />',
    'terminal': '<polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" />',
    'code': '<polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />',
    'mouse-pointer-click': '<path d="M14 4.1 12 6" /><path d="m5.1 8-2.9-.8" /><path d="m6 12-1.9 2" /><path d="M7.2 2.2 8 5.1" /><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />',
    'pointer': '<path d="M22 14a8 8 0 0 1-8 8" /><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" /><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" /><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />',
    'shuffle': '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" /><path d="m18 2 4 4-4 4" /><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" /><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" /><path d="m18 14 4 4-4 4" />',
    'log-in': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" />',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />',
    'power': '<path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" x2="12" y1="2" y2="12" />',
    'save': '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" />',
    'printer': '<polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" />',
    'palette': '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />',
    'wand': '<path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h.01" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />',
    'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />',
    'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />',
    'gift': '<rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8.5v12.5" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />',
    'thumbs-up': '<path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />',
    'thumbs-down': '<path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />',
    'smile': '<circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" />',
    'frown': '<circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" />',

    // Undo / Redo / Corner arrows
    'undo': '<path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />',
    'redo': '<path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />',
    'corner-up-left': '<polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />',
    'corner-up-right': '<polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />',

    // Actions extended
    'scissors': '<circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" />',
    'clipboard-paste': '<path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" /><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2" /><path d="M21 14H11" /><path d="m15 10-4 4 4 4" />',
    'scan': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />',
    'qr-code': '<rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />',

    // Communication extended
    'at-sign': '<circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />',
    'inbox': '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />',
    'mail-open': '<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" /><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />',
    'reply': '<polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />',
    'forward': '<polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" />',
    'video': '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" />',
    'message-square-plus': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M12 7v6" /><path d="M9 10h6" />',

    // Media extended
    'skip-forward': '<polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" />',
    'skip-back': '<polygon points="19 20 9 12 19 4 19 20" /><line x1="5" x2="5" y1="19" y2="5" />',
    'fast-forward': '<polygon points="13 19 22 12 13 5 13 19" /><polygon points="2 19 11 12 2 5 2 19" />',
    'rewind': '<polygon points="11 19 2 12 11 5 11 19" /><polygon points="22 19 13 12 22 5 22 19" />',
    'radio': '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />',
    'headphones': '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />',
    'music': '<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />',

    // Files extended
    'file-code': '<path d="M10 12.5 8 15l2 2.5" /><path d="m14 12.5 2 2.5-2 2.5" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />',
    'file-image': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><circle cx="10" cy="12" r="2" /><path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22" />',
    'file-archive': '<path d="M16 22h2a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v18" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><circle cx="10" cy="20" r="2" /><path d="M10 7V6" /><path d="M10 12v-1" /><path d="M10 18v-2" />',
    'folder-plus': '<path d="M12 10v6" /><path d="M9 13h6" /><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />',
    'hard-drive': '<line x1="22" x2="2" y1="12" y2="12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><line x1="6" x2="6.01" y1="16" y2="16" /><line x1="10" x2="10.01" y1="16" y2="16" />',

    // Status extended
    'shield-alert': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 9v4" /><path d="M12 17h.01" />',
    'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" />',
    'hourglass': '<path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />',
    'timer': '<line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" />',
    'alarm-clock': '<circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M5 3 2 6" /><path d="m22 6-3-3" /><path d="M6.38 18.7 4 21" /><path d="M17.64 18.67 20 21" />',

    // Dev & Infrastructure
    'git-branch': '<line x1="6" x2="6" y1="3" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />',
    'git-commit': '<circle cx="12" cy="12" r="3" /><line x1="3" x2="9" y1="12" y2="12" /><line x1="15" x2="21" y1="12" y2="12" />',
    'git-merge': '<circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />',
    'git-pull-request': '<circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" x2="6" y1="9" y2="21" />',
    'bug': '<path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />',
    'test-tube': '<path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2" /><path d="M8.5 2h7" /><path d="M14.5 16h-5" />',
    'flask': '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" /><path d="M8.5 2h7" /><path d="M7 16h10" />',
    'cpu': '<rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" />',
    'server': '<rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />',
    'wifi': '<path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" />',
    'wifi-off': '<path d="M12 20h.01" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /><path d="M5 12.859a10 10 0 0 1 5.17-2.69" /><path d="M13.41 10.25a10 10 0 0 1 5.59 2.61" /><path d="M2 8.82a15 15 0 0 1 4.17-2.65" /><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" /><line x1="2" x2="22" y1="2" y2="22" />',
    'bluetooth': '<path d="m7 7 10 10-5 5V2l5 5L7 17" />',
    'signal': '<path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" />',

    // Commerce & Finance
    'shopping-cart': '<circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />',
    'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />',
    'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" />',
    'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />',
    'coins': '<circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" />',
    'banknote': '<rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" />',
    'percent': '<line x1="19" x2="5" y1="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />',
    'package': '<path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />',

    // Rich Text / Typography
    'bold': '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />',
    'italic': '<line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" />',
    'underline': '<path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" x2="20" y1="20" y2="20" />',
    'strikethrough': '<path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><line x1="4" x2="20" y1="12" y2="12" />',
    'type': '<polyline points="4 7 4 4 20 4 20 7" /><line x1="9" x2="15" y1="20" y2="20" /><line x1="12" x2="12" y1="4" y2="20" />',
    'heading': '<path d="M6 12h12" /><path d="M6 20V4" /><path d="M18 20V4" />',
    'list': '<line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" />',
    'list-ordered': '<line x1="10" x2="21" y1="6" y2="6" /><line x1="10" x2="21" y1="12" y2="12" /><line x1="10" x2="21" y1="18" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />',
    'align-left': '<line x1="21" x2="3" y1="6" y2="6" /><line x1="15" x2="3" y1="12" y2="12" /><line x1="17" x2="3" y1="18" y2="18" />',
    'align-center': '<line x1="21" x2="3" y1="6" y2="6" /><line x1="17" x2="7" y1="12" y2="12" /><line x1="19" x2="5" y1="18" y2="18" />',
    'align-right': '<line x1="21" x2="3" y1="6" y2="6" /><line x1="21" x2="9" y1="12" y2="12" /><line x1="21" x2="7" y1="18" y2="18" />',
    'align-justify': '<line x1="3" x2="21" y1="6" y2="6" /><line x1="3" x2="21" y1="12" y2="12" /><line x1="3" x2="21" y1="18" y2="18" />',
    'indent-increase': '<polyline points="3 8 7 12 3 16" /><line x1="21" x2="11" y1="12" y2="12" /><line x1="21" x2="11" y1="6" y2="6" /><line x1="21" x2="11" y1="18" y2="18" />',
    'indent-decrease': '<polyline points="7 8 3 12 7 16" /><line x1="21" x2="11" y1="12" y2="12" /><line x1="21" x2="11" y1="6" y2="6" /><line x1="21" x2="11" y1="18" y2="18" />',
    'quote': '<path d="M17 6H3" /><path d="M21 12H8" /><path d="M21 18H8" /><path d="M3 12v6" />',

    // Misc extended
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" />',
    'fingerprint': '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" /><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" /><path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" /><path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" />',
    'languages': '<path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />',
    'newspaper': '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />',
    'megaphone': '<path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />',
    'pin': '<line x1="12" x2="12" y1="17" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.789l-1.78-.89A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.789l-1.78.894A2 2 0 0 0 5 15.24Z" />',
    'map': '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /><path d="M15 5.764v15" /><path d="M9 3.236v15" />',
    'navigation': '<polygon points="3 11 22 2 13 21 11 13 3 11" />',
    'plane': '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />',

    // Shapes extended
    'square': '<rect width="18" height="18" x="3" y="3" rx="2" />',
    'triangle': '<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />',
    'hexagon': '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />',
    'diamond': '<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z" />',
    'octagon': '<path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />',

    // Weather extended
    'cloud-rain': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 14v6" /><path d="M8 14v6" /><path d="M12 16v6" />',
    'cloud-snow': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M8 15h.01" /><path d="M8 19h.01" /><path d="M12 17h.01" /><path d="M12 21h.01" /><path d="M16 15h.01" /><path d="M16 19h.01" />',
    'cloud-lightning': '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" /><path d="m13 12-3 5h4l-3 5" />',
    'wind': '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" /><path d="M9.6 4.6A2 2 0 1 1 11 8H2" /><path d="M12.6 19.4A2 2 0 1 0 14 16H2" />',
    'thermometer': '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />',
    'umbrella': '<path d="M22 12a10.06 10.06 0 0 0-20 0Z" /><path d="M12 12v8a2 2 0 0 0 4 0" /><path d="M12 2v1" />',
    'snowflake': '<line x1="2" x2="22" y1="12" y2="12" /><line x1="12" x2="12" y1="2" y2="22" /><path d="m20 16-4-4 4-4" /><path d="m4 8 4 4-4 4" /><path d="m16 4-4 4-4-4" /><path d="m8 20 4-4 4 4" />',
    'droplet': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />',

    // Calendar extended
    'calendar-days': '<path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3.5 10h17" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" />',
    'calendar-check': '<path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3.5 10h17" /><path d="m9 16 2 2 4-4" />',

    // Misc remaining
    'notebook': '<path d="M2 6h4" /><path d="M2 10h4" /><path d="M2 14h4" /><path d="M2 18h4" /><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M16 2.5v19" />',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />',
    'bookmark-plus': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /><path d="M12 7v6" /><path d="M9 10h6" />',
    'bell-ring': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="M4 2C2.8 3.7 2 5.7 2 8" /><path d="M22 8c0-2.3-.8-4.3-2-6" />',
    'bell-off': '<path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" /><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="m2 2 20 20" />',
    'archive': '<rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" />',
    'anchor': '<circle cx="12" cy="5" r="3" /><line x1="12" x2="12" y1="22" y2="8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" />',
    'crown': '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" />',
    'target': '<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />',
    'crosshair': '<circle cx="12" cy="12" r="10" /><line x1="22" x2="18" y1="12" y2="12" /><line x1="6" x2="2" y1="12" y2="12" /><line x1="12" x2="12" y1="6" y2="2" /><line x1="12" x2="12" y1="22" y2="18" />',
    'siren': '<path d="M7 18v-6a5 5 0 1 1 10 0v6" /><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z" /><path d="M21 12h1" /><path d="M18.5 4.5 18 5" /><path d="M2 12h1" /><path d="M12 2v1" /><path d="m4.929 4.929.707.707" /><path d="M12 12v6" />',
    'telescope': '<path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" /><path d="m13.56 11.747 4.332-.924" /><path d="m16 21-3.105-6.21" /><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" /><path d="m6.158 8.633 1.114 4.456" /><path d="m8 21 3.105-6.21" />',
    'earth': '<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" /><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17" /><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" /><circle cx="12" cy="12" r="10" />',
    'hand': '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />',

    // Transport
    'car': '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />',
    'truck': '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />',
    'bus': '<path d="M8 6v6" /><path d="M15 6v6" /><path d="M2.5 12h19" /><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" /><circle cx="7" cy="18" r="2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" />',
    'train': '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1" /><path d="m9 15-1-1" /><path d="m15 15 1-1" /><rect x="4" y="3" width="16" height="16" rx="2" /><path d="M4.5 11h15" /><path d="m10 21 2-2 2 2" />',
    'bike': '<circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" />',
    'ship': '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" /><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" /><path d="M12 10v4" /><path d="M12 2v3" />',
    'fuel': '<line x1="3" x2="15" y1="22" y2="22" /><line x1="4.5" x2="13.5" y1="9" y2="9" /><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" /><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />',

    // Animals
    'cat': '<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z" /><path d="M8 14v.5" /><path d="M16 14v.5" /><path d="M11.25 16.25h1.5L12 17l-.75-.75Z" />',
    'dog': '<path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" /><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" /><path d="M8 14v.5" /><path d="M16 14v.5" /><path d="M11.25 16.25h1.5L12 17l-.75-.75Z" /><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" />',
    'bird': '<path d="M16 7h.01" /><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" /><path d="m20 7 2 .5-2 .5" /><path d="M10 18v3" /><path d="M14 17.75V21" /><path d="M7 18a6 6 0 0 0 3.84-10.61" />',
    'fish': '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" /><path d="M18 12v.5" /><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" /><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" />',
    'rabbit': '<path d="M13 16a3 3 0 0 1 2.24 5" /><path d="M18 12h.01" /><path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1.93 1.93 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3" /><path d="M13 22H4a2 2 0 1 1 0-4h12" /><path d="M16 9h.01" />',
    'turtle': '<path d="m12 10 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a8 8 0 1 0-16 0v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3l2-4h4Z" /><path d="M4.82 7.9 8 10" /><path d="M15.18 7.9 12 10" /><path d="M16.93 10H20a2 2 0 0 1 0 4H2" />',

    // Food & Drink
    'coffee': '<path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a2 2 0 1 1 0 4" /><path d="M6 2v2" /><path d="M6 18h8" /><path d="M6 22h8" />',
    'wine': '<path d="M8 22h8" /><path d="M7 10h10" /><path d="M12 15v7" /><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />',
    'beer': '<path d="M17 11h1a3 3 0 0 1 0 6h-1" /><path d="M9 12v6" /><path d="M13 12v6" /><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" /><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />',
    'pizza': '<path d="M15 11h.01" /><path d="M11 15h.01" /><path d="M16 16h.01" /><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16" /><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4" />',
    'apple': '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" /><path d="M10 2c1 .5 2 2 2 5" />',
    'cherry': '<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z" /><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z" /><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12" /><path d="M22 9c-4.29 0-7.14-2.33-10-7" />',
    'cake': '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" /><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" /><path d="M2 21h20" /><path d="M7 8v3" /><path d="M12 8v3" /><path d="M17 8v3" /><path d="M7 4h0.01" /><path d="M12 4h0.01" /><path d="M17 4h0.01" />',
    'utensils': '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />',

    // Health
    'heart-pulse': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />',
    'stethoscope': '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" />',
    'pill': '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" />',
    'syringe': '<path d="m18 2 4 4" /><path d="m17 7 3-3" /><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" /><path d="m9 11 4 4" /><path d="m5 19-3 3" /><path d="m14 4 6 6" />',

    // Battery & Power
    'battery': '<rect width="16" height="10" x="2" y="7" rx="2" ry="2" /><line x1="22" x2="22" y1="11" y2="13" />',
    'battery-charging': '<path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" /><path d="M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1" /><line x1="22" x2="22" y1="11" y2="13" /><path d="M7.5 7 12 12H8l4.5 5" />',
    'battery-low': '<rect width="16" height="10" x="2" y="7" rx="2" ry="2" /><line x1="22" x2="22" y1="11" y2="13" /><line x1="6" x2="6" y1="11" y2="13" />',
    'plug': '<path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a6 6 0 0 1-6 6a6 6 0 0 1-6-6V8Z" />',
    'cable': '<path d="M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1" /><path d="M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9" /><path d="M21 21v-2h-4" /><path d="M3 5h4V3" /><path d="M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3" />',

    // More loading/progress
    'gauge': '<path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />',
    'infinity': '<path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />',
    'repeat': '<path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />',
    'repeat-1': '<path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /><path d="M11 10h1v4" />',

    // Rotation/Flip
    'flip-horizontal': '<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" /><path d="M12 20v2" /><path d="M12 14v2" /><path d="M12 8v2" /><path d="M12 2v2" />',
    'flip-vertical': '<path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" /><path d="M2 12h2" /><path d="M8 12h2" /><path d="M14 12h2" /><path d="M20 12h2" />',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.706L3 8" /><path d="M3 3v5h5" />',

    // Education & Books
    'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16c0 1 2 3 6 3s6-2 6-3v-3.5" />',
    'book': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />',
    'book-marked': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><polyline points="10 2 10 10 13 7 16 10 16 2" />',

    // Photography
    'aperture': '<circle cx="12" cy="12" r="10" /><path d="m14.31 8 5.74 9.94" /><path d="M9.69 8h11.48" /><path d="m7.38 12 5.74-9.94" /><path d="M9.69 16 3.95 6.06" /><path d="M14.31 16H2.83" /><path d="m16.62 12-5.74 9.94" />',
    'image-plus': '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /><line x1="16" x2="22" y1="5" y2="5" /><line x1="19" x2="19" y1="2" y2="8" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
    'focus': '<circle cx="12" cy="12" r="3" /><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />',

    // Social
    'rss': '<path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />',
    'podcast': '<path d="M16.85 18.58a9 9 0 1 0-9.7 0" /><path d="M8 14a5 5 0 1 1 8 0" /><circle cx="12" cy="11" r="1" /><path d="M13 17a1 1 0 1 0-2 0l.5 4.5a.5.5 0 1 0 1 0Z" />',

    // More shapes
    'pentagon': '<path d="M3.5 8.7c-.7.5-1 1.4-.7 2.2l2.8 8.7c.3.8 1 1.4 1.9 1.4h9c.9 0 1.6-.6 1.9-1.4l2.8-8.7c.3-.8 0-1.7-.7-2.2l-7.4-5.3a2.1 2.1 0 0 0-2.2 0z" />',
    'circle-dashed': '<path d="M10.1 2.182a10 10 0 0 1 3.8 0" /><path d="M13.9 21.818a10 10 0 0 1-3.8 0" /><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7" /><path d="M2.182 13.9a10 10 0 0 1 0-3.8" /><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69" /><path d="M21.818 10.1a10 10 0 0 1 0 3.8" /><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69" /><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7" />',
    'square-dashed': '<path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" />',

    // Accessibility
    'accessibility': '<circle cx="16" cy="4" r="1" /><path d="m18 19 1-7-6 1" /><path d="m5 8 3-3 5.5 3-2.36 3.5" /><path d="M4.24 14.5a5 5 0 0 0 6.88 6" /><path d="M13.76 17.5a5 5 0 0 0-6.88-6" />',

    // More misc
    'award': '<circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />',
    'medal': '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /><path d="M11 12 5.12 2.2" /><path d="m13 12 5.88-9.8" /><path d="M8 7h8" /><circle cx="12" cy="17" r="5" /><path d="M12 18v-2h-.5" />',
    'dumbbell': '<path d="M14.4 14.4 9.6 9.6" /><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" /><path d="m21.5 21.5-1.4-1.4" /><path d="M3.9 3.9 2.5 2.5" /><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />',
    'clapperboard': '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" /><path d="m6.2 5.3 3.1 3.9" /><path d="m12.4 3.4 3.1 4" /><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />',
    'tent': '<path d="M3.5 21 14 3" /><path d="M20.5 21 10 3" /><path d="M15.5 21 12 15l-3.5 6" /><path d="M2 21h20" />',
    'mountain': '<path d="m8 3 4 8 5-5 5 15H2z" />',
    'sunrise': '<path d="M12 10V2" /><path d="m4.93 10.93 1.41 1.41" /><path d="M2 18h2" /><path d="M20 18h2" /><path d="m19.07 10.93-1.41 1.41" /><path d="M22 22H2" /><path d="m8 6 4-4 4 4" /><path d="M16 18a4 4 0 0 0-8 0" />',
    'sunset': '<path d="M12 2v8" /><path d="m4.93 10.93 1.41 1.41" /><path d="M2 18h2" /><path d="M20 18h2" /><path d="m19.07 10.93-1.41 1.41" /><path d="M22 22H2" /><path d="m16 6-4 4-4-4" /><path d="M16 18a4 4 0 0 0-8 0" />',
    'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />',
    'bone': '<path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />',
    'paw-print': '<circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />',
    'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />',
    'sprout': '<path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />',

    // Arrows extended
    'arrow-big-up': '<path d="M9 18v-6H5l7-7 7 7h-4v6H9z" />',
    'arrow-big-down': '<path d="M15 6v6h4l-7 7-7-7h4V6h6z" />',
    'arrow-big-left': '<path d="M18 15h-6v4l-7-7 7-7v4h6v6z" />',
    'arrow-big-right': '<path d="M6 9h6V5l7 7-7 7v-4H6V9z" />',
    'arrow-up-down': '<path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" />',
    'arrow-left-right': '<path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />',
    'corner-down-left': '<polyline points="9 10 4 15 9 20" /><path d="M20 4v7a4 4 0 0 1-4 4H4" />',
    'corner-down-right': '<polyline points="15 10 20 15 15 20" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />',
    'move-diagonal': '<polyline points="13 5 19 5 19 11" /><polyline points="11 19 5 19 5 13" /><line x1="19" x2="5" y1="5" y2="19" />',


    // Text & Formatting extended
    'subscript': '<path d="m4 5 8 8" /><path d="m12 5-8 8" /><path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07" />',
    'superscript': '<path d="m4 19 8-8" /><path d="m12 19-8-8" /><path d="M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06" />',
    'spell-check': '<path d="m6 16 6-12 6 12" /><path d="M8 12h8" /><path d="m16 20 2 2 4-4" />',
    'case-upper': '<path d="m3 15 4-8 4 8" /><path d="M4 13h6" /><path d="M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4" />',
    'case-lower': '<circle cx="7" cy="12" r="3" /><path d="M10 9v6" /><circle cx="17" cy="12" r="3" /><path d="M14 7v8" />',
    'wrap-text': '<line x1="3" x2="21" y1="6" y2="6" /><path d="M3 12h15a3 3 0 1 1 0 6h-4" /><polyline points="16 16 14 18 16 20" /><line x1="3" x2="10" y1="18" y2="18" />',
    'pilcrow': '<path d="M13 4v16" /><path d="M17 4v16" /><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />',
    'text-cursor': '<path d="M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1" /><path d="M7 22h1a4 4 0 0 0 4-4v-1" /><path d="M7 2h1a4 4 0 0 1 4 4v1" />',
    'list-checks': '<path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" />',
    'list-tree': '<path d="M21 12h-8" /><path d="M21 6H8" /><path d="M21 18h-8" /><path d="M3 6v4c0 1.1.9 2 2 2h3" /><path d="M3 10v6c0 1.1.9 2 2 2h3" />',
    'list-collapse': '<path d="m3 10 2.5-2.5L3 5" /><path d="m3 19 2.5-2.5L3 14" /><path d="M10 6h11" /><path d="M10 12h11" /><path d="M10 18h11" />',

    // Shapes extended
    'heart-crack': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="m12 13-1-1 2-2-3-3 2-2" />',
    'heart-handshake': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66" /><path d="m18 15-2-2" /><path d="m15 18-2-2" />',
    'star-half': '<path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2" />',
    'star-off': '<path d="M8.34 8.34 2 9.27l5 4.87L5.82 21 12 17.77 18.18 21l-.59-3.43" /><path d="M18.42 12.76 22 9.27l-6.91-1L12 2l-1.44 2.91" /><line x1="2" x2="22" y1="2" y2="22" />',
    'circle-check': '<circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />',
    'circle-x': '<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />',
    'circle-alert': '<circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />',
    'circle-plus': '<circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />',
    'circle-minus': '<circle cx="12" cy="12" r="10" /><path d="M8 12h8" />',
    'circle-pause': '<circle cx="12" cy="12" r="10" /><line x1="10" x2="10" y1="15" y2="9" /><line x1="14" x2="14" y1="15" y2="9" />',
    'circle-play': '<circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />',
    'circle-stop': '<circle cx="12" cy="12" r="10" /><rect x="9" y="9" width="6" height="6" />',
    'circle-arrow-up': '<circle cx="12" cy="12" r="10" /><path d="m16 12-4-4-4 4" /><path d="M12 16V8" />',
    'circle-arrow-down': '<circle cx="12" cy="12" r="10" /><path d="m8 12 4 4 4-4" /><path d="M12 8v8" />',
    'circle-arrow-left': '<circle cx="12" cy="12" r="10" /><path d="m12 8-4 4 4 4" /><path d="M16 12H8" />',
    'circle-arrow-right': '<circle cx="12" cy="12" r="10" /><path d="m12 16 4-4-4-4" /><path d="M8 12h8" />',
    'circle-ellipsis': '<circle cx="12" cy="12" r="10" /><path d="M17 12h.01" /><path d="M12 12h.01" /><path d="M7 12h.01" />',
    'circle-user': '<circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />',
    'circle-help': '<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />',
    'square-check': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 12 2 2 4-4" />',
    'square-x': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />',
    'square-plus': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 12h8" /><path d="M12 8v8" />',
    'square-minus': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 12h8" />',
    'square-arrow-up-right': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 16 16 8" /><path d="M16 16V8H8" />',
    'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />',

    // Media extended
    'volume': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />',
    'volume-1': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />',
    'music-2': '<circle cx="8" cy="18" r="4" /><path d="M12 18V2l7 4" />',
    'music-3': '<circle cx="12" cy="18" r="4" /><path d="M16 18V2" />',
    'headset': '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" /><path d="M21 16v2a4 4 0 0 1-4 4h-5" />',
    'radio-tower': '<path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" /><path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" /><circle cx="12" cy="9" r="2" /><path d="M16.2 4.7a6.14 6.14 0 0 1 .8 7.5" /><path d="M19.1 1.9a10.14 10.14 0 0 1 0 14.2" /><path d="M9.56 13.56a10 10 0 0 1 4.88 0" /><path d="m12 17-2 5" /><path d="m14 22-2-5" />',
    'tv': '<rect width="20" height="15" x="2" y="7" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" />',
    'monitor': '<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />',
    'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />',
    'tablet': '<rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><line x1="12" x2="12.01" y1="18" y2="18" />',
    'laptop': '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />',
    'projector': '<path d="M5 7 3 5" /><path d="M9 6V3" /><path d="m13 7 2-2" /><circle cx="9" cy="13" r="3" /><path d="M11.83 12H20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2.17" /><path d="M16 16h2" />',

    // Devices & Hardware
    'watch': '<circle cx="12" cy="12" r="6" /><polyline points="12 10 12 12 13 13" /><path d="m16.51 17.35-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83" />',
    'printer-check': '<path d="M13.5 22H7a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v.5" /><path d="m16 19 2 2 4-4" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" /><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />',
    'mouse': '<rect x="5" y="2" width="14" height="20" rx="7" /><path d="M12 6v4" />',
    'keyboard': '<rect width="20" height="16" x="2" y="4" rx="2" ry="2" /><path d="M6 8h.001" /><path d="M10 8h.001" /><path d="M14 8h.001" /><path d="M18 8h.001" /><path d="M8 12h.001" /><path d="M12 12h.001" /><path d="M16 12h.001" /><path d="M7 16h10" />',
    'gamepad-2': '<line x1="6" x2="10" y1="11" y2="11" /><line x1="8" x2="8" y1="9" y2="13" /><line x1="15" x2="15.01" y1="12" y2="12" /><line x1="18" x2="18.01" y1="10" y2="10" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />',

    // People & Gestures
    'user-round': '<circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />',
    'user-cog': '<circle cx="18" cy="15" r="3" /><circle cx="9" cy="7" r="4" /><path d="M10 15H6a4 4 0 0 0-4 4v2" /><path d="m21.7 16.4-.9-.3" /><path d="m15.2 13.9-.9-.3" /><path d="m16.6 18.7.3-.9" /><path d="m19.1 12.2.3-.9" /><path d="m19.6 18.7-.4-1" /><path d="m16.8 12.3-.4-1" /><path d="m14.3 16.6 1-.4" /><path d="m20.7 13.8 1-.4" />',
    'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" x2="22" y1="8" y2="13" /><line x1="22" x2="17" y1="8" y2="13" />',
    'users-round': '<path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />',
    'contact': '<path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" /><rect width="18" height="18" x="3" y="4" rx="2" /><circle cx="12" cy="10" r="2" /><line x1="8" x2="8" y1="2" y2="4" /><line x1="16" x2="16" y1="2" y2="4" />',
    'baby': '<path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />',
    'person-standing': '<circle cx="12" cy="5" r="1" /><path d="m9 20 3-6 3 6" /><path d="m6 8 6 2 6-2" /><path d="M12 10v4" />',

    // Building & Architecture
    'building': '<rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" />',
    'building-2': '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />',
    'church': '<path d="m18 7 4 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9l4-2" /><path d="M14 22v-4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v4" /><path d="M18 22V5l-6-3-6 3v17" /><path d="M12 7v5" /><path d="M10 9h4" />',
    'factory': '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" />',
    'landmark': '<line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" />',
    'hotel': '<path d="M10 22v-6.57" /><path d="M12 11h.01" /><path d="M12 7h.01" /><path d="M14 15.43V22" /><path d="M15 16a5 5 0 0 0-6 0" /><path d="M16 11h.01" /><path d="M16 7h.01" /><path d="M8 11h.01" /><path d="M8 7h.01" /><rect x="4" y="2" width="16" height="20" rx="2" />',
    'warehouse': '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" /><path d="M6 18h12" /><path d="M6 14h12" /><rect width="12" height="12" x="6" y="10" />',
    'store': '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />',

    // Science & Math
    'atom': '<circle cx="12" cy="12" r="1" /><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" /><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />',
    'beaker': '<path d="M4.5 3h15" /><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" /><path d="M6 14h12" />',
    'microscope': '<path d="M6 18h8" /><path d="M3 22h18" /><path d="M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2" /><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" /><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />',
    'dna': '<path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" /><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /><path d="m17 6-2.5-2.5" /><path d="m14 8-1-1" /><path d="m7 18 2.5 2.5" /><path d="m3.5 14.5.5.5" /><path d="m20 9 .5.5" /><path d="m6.5 12.5 1 1" /><path d="m16.5 10.5 1 1" /><path d="m10 16 1.5 1.5" />',
    'sigma': '<path d="M18 7V4H6l6 8-6 8h12v-3" />',
    'omega': '<path d="M3 20h4.5a.5.5 0 0 0 .5-.5v-.282a.52.52 0 0 0-.247-.437C5.962 17.61 5 15.634 5 12a7 7 0 1 1 14 0c0 3.634-.962 5.61-2.753 6.781a.52.52 0 0 0-.247.437v.282a.5.5 0 0 0 .5.5H21" />',
    'calculator': '<rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" />',
    'binary': '<rect x="14" y="14" width="4" height="6" rx="2" /><rect x="6" y="4" width="4" height="6" rx="2" /><path d="M6 20h4" /><path d="M14 10h4" /><path d="M6 14h2v6" /><path d="M14 4h2v6" />',

    // Commerce extended
    'shopping-basket': '<path d="m15 11-1 9" /><path d="m19 11-4-7" /><path d="M2 11h20" /><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" /><path d="m9 11 1 9" /><path d="M4.5 15.5h15" /><path d="m5 11 4-7" />',
    'badge-dollar-sign': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" />',
    'badge-percent': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m15 9-6 6" /><path d="M9 9h.01" /><path d="M15 15h.01" />',
    'receipt-text': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M14 8H8" /><path d="M16 12H8" /><path d="M13 16H8" />',
    'ticket': '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />',
    'barcode': '<path d="M3 5v14" /><path d="M8 5v14" /><path d="M12 5v14" /><path d="M17 5v14" /><path d="M21 5v14" />',

    // Weather extended
    'cloud-sun': '<path d="M12 2v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="M20 12h2" /><path d="m19.07 4.93-1.41 1.41" /><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />',
    'cloud-fog': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 17H7" /><path d="M17 21H9" />',
    'cloud-drizzle': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M8 19v1" /><path d="M8 14v1" /><path d="M16 19v1" /><path d="M16 14v1" /><path d="M12 21v1" /><path d="M12 16v1" />',
    'rainbow': '<path d="M22 17a10 10 0 0 0-20 0" /><path d="M6 17a6 6 0 0 1 12 0" /><path d="M10 17a2 2 0 0 1 4 0" />',
    'tornado': '<path d="M21 4H3" /><path d="M18 8H6" /><path d="M19 12H9" /><path d="M16 16h-6" /><path d="M11 20H9" />',
    'thermometer-sun': '<path d="M12 9a4 4 0 0 0-2 7.5" /><path d="M12 3v2" /><path d="m6.6 18.4-1.4 1.4" /><path d="M20 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /><path d="M4 13H2" /><path d="M6.34 7.34 4.93 5.93" />',
    'umbrella-off': '<path d="M12 2v1" /><path d="M2 12h1" /><path d="m5 5 1.8 1.8" /><path d="M17.2 17.2 22 22" /><path d="m2 2 20 20" /><path d="M12 12v9" /><path d="M9.7 21.3A6 6 0 0 0 12 21" /><path d="M22 12c0-5.5-4.5-10-10-10-.7 0-1.4.1-2.1.2" /><path d="M2.06 11.2A10 10 0 0 1 5 4.8" /><path d="M12 2a10 10 0 0 1 10 10c0 .88-.12 1.73-.33 2.54" />',

    // Travel & Maps
    'map-pinned': '<path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" /><circle cx="12" cy="8" r="2" /><path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712" />',
    'milestone': '<path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z" /><path d="M12 13v8" /><path d="M12 3v3" />',
    'signpost': '<path d="M12 3v3" /><path d="M18.5 13h-13L2 9.5 5.5 6h13L22 9.5Z" /><path d="M12 13v8" />',
    'route': '<circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" />',
    'plane-takeoff': '<path d="M2 22h20" /><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2L22 4.5" />',
    'plane-landing': '<path d="M2 22h20" /><path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8l-1.5 4.5 1-.5a2.55 2.55 0 0 1 2.94.53l2.49 2.38A2 2 0 0 1 11.5 19H4.5" />',

    // Security & Privacy
    'shield-off': '<path d="m2 2 20 20" /><path d="M5 5a1 1 0 0 0-1 .5C4 6 4 7 4 7s0 9.34 8 12.64c1.47-.59 2.7-1.38 3.7-2.3" /><path d="M20 7s0-.5-1-1.5S16 3 12 3c-1.39 0-2.58.22-3.58.56" />',
    'shield-question': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 .5.1 1 .2 1.5" /><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" /><path d="M12 17h.01" />',
    'lock-keyhole': '<circle cx="12" cy="16" r="1" /><rect x="3" y="10" width="18" height="12" rx="2" /><path d="M7 10V7a5 5 0 0 1 10 0v3" />',
    'key-round': '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />',
    'scan-face': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" />',
    'scan-eye': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="1" /><path d="M5 12s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5" />',

    // Alignment & Spacing
    'align-start-vertical': '<rect width="9" height="6" x="6" y="14" rx="2" /><rect width="16" height="6" x="6" y="4" rx="2" /><path d="M2 2v20" />',
    'align-end-vertical': '<rect width="9" height="6" x="9" y="14" rx="2" /><rect width="16" height="6" x="2" y="4" rx="2" /><path d="M22 2v20" />',
    'align-start-horizontal': '<rect width="6" height="16" x="4" y="6" rx="2" /><rect width="6" height="9" x="14" y="6" rx="2" /><path d="M22 2H2" />',
    'align-end-horizontal': '<rect width="6" height="16" x="4" y="2" rx="2" /><rect width="6" height="9" x="14" y="9" rx="2" /><path d="M22 22H2" />',
    'align-center-vertical': '<path d="M12 2v20" /><rect width="8" height="6" x="1" y="14" rx="2" /><rect width="12" height="6" x="3" y="4" rx="2" />',
    'align-center-horizontal': '<path d="M2 12h20" /><rect width="6" height="8" x="14" y="1" rx="2" /><rect width="6" height="12" x="4" y="3" rx="2" />',
    'space-between': '<rect width="6" height="14" x="9" y="5" rx="2" /><path d="M22 2H2" /><path d="M22 22H2" />',
    'distribute-vertical': '<line x1="2" x2="22" y1="4" y2="4" /><line x1="2" x2="22" y1="12" y2="12" /><line x1="2" x2="22" y1="20" y2="20" /><rect x="6" y="8" width="12" height="8" rx="2" />',
    'distribute-horizontal': '<line x1="4" x2="4" y1="2" y2="22" /><line x1="12" x2="12" y1="2" y2="22" /><line x1="20" x2="20" y1="2" y2="22" /><rect x="8" y="6" width="8" height="12" rx="2" />',

    // Coding & Dev
    'code-xml': '<path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />',
    'braces': '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" /><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />',
    'brackets': '<path d="M16 3h3v18h-3" /><path d="M8 21H5V3h3" />',
    'regex': '<path d="M17 3v10" /><path d="m12.67 5.5 8.66 5" /><path d="m12.67 10.5 8.66-5" /><path d="M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2z" />',
    'variable': '<path d="M8 21s-4-3-4-9 4-9 4-9" /><path d="M16 3s4 3 4 9-4 9-4 9" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" />',
    'file-json': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" /><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />',
    'file-terminal': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m8 16 2-2-2-2" /><path d="M13 16h3" />',
    'git-compare': '<circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" />',
    'git-fork': '<circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" /><path d="M12 12v3" />',
    'webhook': '<path d="M18 16.98h1a2 2 0 0 0 1.22-3.58L13 9l.01-.01A6.5 6.5 0 0 0 6 3.08" /><path d="M9.63 8.13a6.5 6.5 0 1 0 9.12 7.23" /><path d="M12 16.98a6.5 6.5 0 0 0-5.7 3.97" /><circle cx="12" cy="17" r="1" />',
    'container': '<path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-.8.9-1.5Z" /><path d="M10 21.9V14L2.1 9.1" /><path d="m10 14 11.9-6.9" /><path d="M14 19.8v-8.1" /><path d="M18 17.5V9.4" />',

    // Misc Symbols
    'crown-simple': '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 21h14" />',
    'gem': '<path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" />',
    'lamp': '<path d="M8 2h8l4 10H4L8 2Z" /><path d="M12 12v6" /><path d="M8 22v-2c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v2H8Z" />',
    'lamp-desk': '<path d="m14 5-3 3 2 7 8-8-7-2Z" /><path d="m14 5-3 3-3-3 3-3 3 3Z" /><path d="M9.5 6.5 4 12l3 6" /><path d="M3 22v-2c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v2H3Z" />',
    'paintbrush': '<path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" /><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" /><path d="M14.5 17.5 4.5 15" />',
    'brush': '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" /><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />',
    'eraser': '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" />',
    'stamp': '<path d="M5 22h14" /><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z" /><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />',
    'sticker': '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" /><path d="M14 3v4a2 2 0 0 0 2 2h4" /><path d="M8 13h.01" /><path d="M16 13h.01" /><path d="M10 17c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />',

    'at-sign-2': '<path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.28" />',
    'message-circle-more': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" />',
    'messages-square': '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />',
    'bell-plus': '<path d="M19.3 14.8C20.1 16.4 21 17 21 17H3s3-2 3-9c0-3.3 2.7-6 6-6 .7 0 1.3.1 1.9.3" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M18 8V2" /><path d="M21 5h-6" />',
    'bell-minus': '<path d="M19.3 14.8C20.1 16.4 21 17 21 17H3s3-2 3-9c0-3.3 2.7-6 6-6 .7 0 1.3.1 1.9.3" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M15 5h6" />',
    'folder-search': '<circle cx="17" cy="17" r="3" /><path d="M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1" /><path d="m21 21-1.5-1.5" />',
    'folder-lock': '<rect width="8" height="5" x="14" y="17" rx="1" /><path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2.5" /><path d="M20 17v-2a2 2 0 1 0-4 0v2" />',
    'folder-tree': '<path d="M20 10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2.5a2 2 0 0 1-1.69-.9L15 2H9L8.2 3.1A2 2 0 0 1 6.5 4H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2Z" /><path d="M20 22a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2.5a2 2 0 0 1-1.69-.9L15 14H9l-.81 1.1A2 2 0 0 1 6.5 16H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2Z" /><path d="M2 10v4" />',

    // Notifications & Status
    'badge-info': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" />',
    'badge-alert': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />',
    'badge-x': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" />',
    'badge-plus': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" />',
    'badge-minus': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><line x1="8" x2="16" y1="12" y2="12" />',
    'siren-alert': '<path d="M7 12a5 5 0 0 1 10 0v6H7v-6z" /><path d="M12 7V3" /><path d="m4.4 10-1.8-1" /><path d="m21.4 9-1.8 1" /><path d="M5 18h14" /><path d="M3 22h18" />',
    'megaphone-off': '<path d="M9.26 9.26 3 11v3l14.14 3.14" /><path d="M21 15.34V6l-7.31 2.03" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /><line x1="2" x2="22" y1="2" y2="22" />',

    // ──── Batch 2: Expanding to 1000 icons ────

    // Arrows & Pointers extended
    'arrow-up-from-line': '<path d="m18 9-6-6-6 6" /><path d="M12 3v14" /><path d="M5 21h14" />',
    'arrow-down-to-line': '<path d="M12 7v10" /><path d="m6 13 6 6 6-6" /><path d="M5 3h14" />',
    'arrow-left-from-line': '<path d="m9 6-6 6 6 6" /><path d="M3 12h14" /><path d="M21 19V5" />',
    'arrow-right-from-line': '<path d="m15 18 6-6-6-6" /><path d="M3 5v14" /><path d="M7 12h14" />',
    'arrow-up-to-line': '<path d="M5 3h14" /><path d="m18 13-6-6-6 6" /><path d="M12 7v14" />',
    'arrow-down-from-line': '<path d="M19 3H5" /><path d="m6 11 6 6 6-6" /><path d="M12 17V3" />',
    'arrow-left-to-line': '<path d="M3 5v14" /><path d="m13 18-6-6 6-6" /><path d="M7 12h14" />',
    'arrow-right-to-line': '<path d="M17 12H3" /><path d="m11 18 6-6-6-6" /><path d="M21 5v14" />',
    'undo-2': '<path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />',
    'redo-2': '<path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" />',
    'iteration-cw': '<path d="M4 10c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8H4" /><polyline points="8 22 4 18 8 14" />',
    'iteration-ccw': '<path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8 3.6 8 8 8h8" /><polyline points="16 14 20 18 16 22" />',

    // More UI elements
    'panel-left-close': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3.5v17" /><path d="m16 15-3-3 3-3" />',
    'panel-left-open': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3.5v17" /><path d="m14 9 3 3-3 3" />',
    'panel-right-close': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3.5v17" /><path d="m8 9 3 3-3 3" />',
    'panel-right-open': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3.5v17" /><path d="m10 15-3-3 3-3" />',
    'panel-top-close': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 9h17" /><path d="m9 16 3-3 3 3" />',
    'panel-top-open': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 9h17" /><path d="m15 14-3 3-3-3" />',
    'panel-bottom-close': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 15h17" /><path d="m15 8-3 3-3-3" />',
    'panel-bottom-open': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3.5 15h17" /><path d="m9 10 3-3 3 3" />',
    'picture-in-picture': '<path d="M8 4.5v5H3m-1-6 6 6m13 0v-3c0-1.16-.84-2-2-2h-7m-6 10 .72-.72a2 2 0 0 1 2.28-.36l.72.36a2 2 0 0 0 2.28-.36L12 10l6 5h1a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1" />',
    'app-window': '<rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 4v4" /><path d="M2 8h20" /><path d="M6 4v4" />',
    'app-window-mac': '<rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 8h20" /><circle cx="8" cy="6" r=".5" fill="currentColor" /><circle cx="6" cy="6" r=".5" fill="currentColor" /><circle cx="10" cy="6" r=".5" fill="currentColor" />',
    'gallery-horizontal': '<path d="M2 3v18" /><rect width="12" height="18" x="6" y="3" rx="2" /><path d="M22 3v18" />',
    'gallery-vertical': '<path d="M3 2h18" /><rect width="18" height="12" x="3" y="6" rx="2" /><path d="M3 22h18" />',
    'dock': '<path d="M2 8h20" /><rect width="20" height="16" x="2" y="4" rx="2" /><path d="M6 16h12" />',
    'ratio': '<rect width="12" height="20" x="6" y="2" rx="2" />',
    'scaling': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M14 15H9v-5" /><path d="M16 3h5v5" /><path d="M21 3 9 15" />',
    'move': '<polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" x2="22" y1="12" y2="12" /><line x1="12" x2="12" y1="2" y2="22" />',
    'grab': '<path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4" /><path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5" /><path d="M6 14a2 2 0 0 0-2 2c0 1.7.83 2.97 1.54 4.12.36.6.77 1.31 1.07 2.1a.5.5 0 0 0 .47.33h8.96a.48.48 0 0 0 .48-.36c.3-1.09.72-2 1.12-2.85C18.4 17.55 20 15.75 20 14V9a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />',

    // Files extended
    'file-check': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m9 15 2 2 4-4" />',
    'file-x': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m14.5 12.5-5 5" /><path d="m9.5 12.5 5 5" />',
    'file-minus': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 15h6" />',
    'file-search': '<path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3" /><path d="m9 18-1.5-1.5" /><circle cx="5" cy="14" r="3" />',
    'file-lock': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><rect width="8" height="6" x="8" y="12" rx="1" /><path d="M10 12v-2a2 2 0 1 1 4 0v2" />',
    'file-warning': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M12 9v4" /><path d="M12 17h.01" />',
    'file-heart': '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v2" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10.29 10.7a2.43 2.43 0 0 0-2.66-.52c-.29.12-.56.3-.78.53l-.35.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L6.5 18l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z" />',
    'file-spreadsheet': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M8 13h2" /><path d="M14 13h2" /><path d="M8 17h2" /><path d="M14 17h2" />',
    'file-video': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m10 11 5 3-5 3v-6Z" />',
    'file-audio': '<path d="M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M2 19a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 1 1-4 0v-1a2 2 0 1 1 4 0" />',
    'file-type': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 13v-1h6v1" /><path d="M12 12v6" /><path d="M11 18h2" />',
    'file-pen': '<path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />',
    'file-symlink': '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v7" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m5 17-3 3 3 3" /><path d="M2 20h9.5a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5H8" />',
    'file-output': '<path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M4 7V4a2 2 0 0 1 2-2 2 2 0 0 0-2 2" /><path d="M4.063 20.999a2 2 0 0 0 2 1L18 22a2 2 0 0 0 2-2V7l-5-5H6" /><path d="m5 11-3 3" /><path d="m5 17-3-3h10" />',
    'file-input': '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M2 15h10" /><path d="m9 18 3-3-3-3" />',
    'file-up': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 12v6" /><path d="m15 15-3-3-3 3" />',
    'file-down': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />',
    'files': '<path d="M20 7h-3a2 2 0 0 1-2-2V2" /><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" /><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" />',
    'folder-check': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /><path d="m9 13 2 2 4-4" />',
    'folder-x': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /><path d="m9.5 10.5 5 5" /><path d="m14.5 10.5-5 5" />',
    'folder-minus': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /><path d="M9 13h6" />',
    'folder-up': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /><path d="M12 10v6" /><path d="m9 13 3-3 3 3" />',
    'folder-down': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /><path d="M12 10v6" /><path d="m15 13-3 3-3-3" />',
    'folder-input': '<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1" /><path d="M2 13h10" /><path d="m9 16 3-3-3-3" />',
    'folder-output': '<path d="M2 7.5V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1" /><path d="M2 13h10" /><path d="m5 10-3 3 3 3" />',
    'folder-sync': '<path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v.5" /><path d="M12 10v4h4" /><path d="m12 14 1.535-1.605a5 5 0 0 1 8 1.5" /><path d="M22 22v-4h-4" /><path d="m22 18-1.535 1.605a5 5 0 0 1-8-1.5" />',
    'folder-heart': '<path d="M11 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v1.5" /><path d="M13.9 17.45c-1.2-1.2-1.14-2.8-.2-3.73a2.43 2.43 0 0 1 3.44 0l.36.34.34-.34a2.43 2.43 0 0 1 3.45-.01v0c.95.95 1 2.53-.2 3.74L17.5 21Z" />',

    // Calendar & Time extended
    'calendar-clock': '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h5" /><circle cx="18" cy="17" r="5" /><path d="M18 14v3l2 1" />',
    'calendar-x': '<path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="m17 17 5 5" /><path d="m22 17-5 5" />',
    'calendar-plus': '<path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M16 19h6" /><path d="M19 16v6" />',
    'calendar-minus': '<path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M16 19h6" />',
    'calendar-heart': '<path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M21.07 16.22c-.39-.4-1.03-.4-1.42 0l-.35.35-.35-.35a1.008 1.008 0 0 0-1.42 0c-.39.39-.39 1.03 0 1.42l1.42 1.42.35.35 1.42-1.42c.39-.39.59-1.03.35-1.77z" />',
    'calendar-range': '<rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M3 10h18" /><path d="M8 2v4" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" />',
    'calendar-search': '<path d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="m22 22-1.5-1.5" />',
    'timer-off': '<path d="M10 2h4" /><path d="M4.6 11a8 8 0 0 0 1.7 8.7 8 8 0 0 0 8.7 1.7" /><path d="M7.4 7.4a8 8 0 0 1 10.3 1 8 8 0 0 1 .9 10.2" /><path d="m2 2 20 20" /><path d="M12 12v-2" />',
    'timer-reset': '<path d="M10 2h4" /><path d="M12 14v-4" /><path d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1-5.3 14L4 17.6" /><path d="M9 17H4v5" />',
    'clock-1': '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 14.5 8" />',
    'clock-2': '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 10" />',
    'clock-3': '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16.5 12" />',
    'clock-4': '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 15 15" />',
    'clock-12': '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12" />',
    'stopwatch': '<circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M5 3 2 6" /><path d="m22 6-3-3" /><path d="M6.38 18.7 4 21" /><path d="M17.64 18.67 20 21" /><path d="M12 2v3" />',

    // Chart & Data Viz
    'bar-chart-3': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 16h8" /><path d="M7 11h12" /><path d="M7 6h3" />',
    'bar-chart-4': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 17.5V14" /><path d="M11 17.5V8" /><path d="M15 17.5V4" /><path d="M19 17.5v-6" />',
    'line-chart': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" />',
    'area-chart': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 11.207a.5.5 0 0 1 .146-.353l2-2a.5.5 0 0 1 .708 0l3.292 3.292a.5.5 0 0 0 .708 0l4.292-4.292a.5.5 0 0 1 .854.353V16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />',
    'candlestick-chart': '<path d="M9 5v4" /><rect width="4" height="6" x="7" y="9" rx="1" /><path d="M9 15v2" /><path d="M17 3v2" /><rect width="4" height="6" x="15" y="5" rx="1" /><path d="M17 11v2" /><path d="M3 3v16a2 2 0 0 0 2 2h16" />',
    'scatter-chart': '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="18.5" cy="5.5" r=".5" fill="currentColor" /><circle cx="11.5" cy="11.5" r=".5" fill="currentColor" /><circle cx="7.5" cy="16.5" r=".5" fill="currentColor" /><circle cx="13.5" cy="14.5" r=".5" fill="currentColor" /><circle cx="18" cy="13" r=".5" fill="currentColor" /><path d="M3 3v16a2 2 0 0 0 2 2h16" />',
    'chart-no-axes-column': '<line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" />',
    'chart-no-axes-combined': '<path d="M12 16v5" /><path d="M16 14v7" /><path d="M20 10v11" /><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15" /><path d="M4 18v3" /><path d="M8 14v7" />',
    'chart-pie': '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.949v8a1 1 0 0 0 1 1z" /><path d="M21.21 15.89A10 10 0 1 1 8 2.83" />',
    'chart-spline': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 16c.5-2 1.5-7 4-7 2 0 2 3 4 3 2.5 0 4.5-5 5-7" />',
    'chart-column-stacked': '<path d="M11 13H7" /><path d="M19 9h-4" /><path d="M3 3v16a2 2 0 0 0 2 2h16" /><rect x="15" y="5" width="4" height="12" rx="1" /><rect x="7" y="8" width="4" height="9" rx="1" />',

    // Users & Contacts extended
    'contact-round': '<circle cx="12" cy="6" r="4" /><path d="M17.2 13.7A7.93 7.93 0 0 0 12 12a7.93 7.93 0 0 0-5.2 1.7" /><rect width="18" height="18" x="3" y="4" rx="2" />',
    'users-2': '<path d="M14 19a6 6 0 0 0-12 0" /><circle cx="8" cy="9" r="4" /><path d="M22 19a6 6 0 0 0-6-6 4 4 0 1 0 0-8" />',
    'user-search': '<circle cx="10" cy="7" r="4" /><path d="M10.3 15H7a4 4 0 0 0-4 4v2" /><circle cx="17" cy="17" r="3" /><path d="m21 21-1.9-1.9" />',
    'user-pen': '<path d="M11.5 15H7a4 4 0 0 0-4 4v2" /><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" /><circle cx="10" cy="7" r="4" />',
    'circle-user-round': '<path d="M18 20a6 6 0 0 0-12 0" /><circle cx="12" cy="10" r="4" /><circle cx="12" cy="12" r="10" />',

    // Lock & Key extended
    'key-square': '<path d="M12.4 2.7a2.5 2.5 0 0 1 3.4 0l5.5 5.5a2.5 2.5 0 0 1 0 3.4l-3.7 3.7a2.5 2.5 0 0 1-3.4 0L8.7 9.8a2.5 2.5 0 0 1 0-3.4z" /><path d="m14 7 3 3" /><path d="m9.4 10.6-6.814 6.814A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814" />',

    // Communication extended
    'phone-call': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /><path d="M14.05 2a9 9 0 0 1 8 7.94" /><path d="M14.05 6A5 5 0 0 1 18 10" />',
    'phone-incoming': '<polyline points="16 2 16 8 22 8" /><line x1="22" x2="16" y1="2" y2="8" /><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />',
    'phone-outgoing': '<polyline points="22 8 22 2 16 2" /><line x1="16" x2="22" y1="8" y2="2" /><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />',
    'phone-missed': '<line x1="22" x2="16" y1="2" y2="8" /><line x1="16" x2="22" y1="2" y2="8" /><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />',
    'phone-off': '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="22" x2="2" y1="2" y2="22" />',
    'phone-forwarded': '<polyline points="18 2 22 6 18 10" /><line x1="14" x2="22" y1="6" y2="6" /><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />',
    'voicemail': '<circle cx="6" cy="12" r="4" /><circle cx="18" cy="12" r="4" /><line x1="6" x2="18" y1="16" y2="16" />',
    'mail-check': '<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" />',
    'mail-x': '<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m17 17 4 4" /><path d="m21 17-4 4" />',
    'mail-plus': '<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="M19 16v6" /><path d="M16 19h6" />',
    'mail-minus': '<path d="M22 15V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="M16 19h6" />',
    'mail-search': '<path d="M22 12.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h7.5" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><circle cx="18" cy="18" r="3" /><path d="m22 22-1.5-1.5" />',
    'mail-warning': '<path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="M20 14v4" /><path d="M20 22v.01" />',

    // Ecommerce & Payment
    'credit-card-off': '<line x1="2" x2="22" y1="2" y2="22" /><path d="M3.17 7.83 2 9v9a2 2 0 0 0 2 2h16" /><path d="m21.99 7-.67-.67a2 2 0 0 0-.56-.34L20 5.65A2 2 0 0 0 18.65 5H6" /><path d="M2 13h4" />',
    'wallet-cards': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" /><path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21" />',
    'hand-coins': '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" /><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /><path d="m2 16 6 6" /><circle cx="16" cy="9" r="2.9" /><circle cx="6" cy="5" r="3" />',
    'piggy-bank': '<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><path d="M16 11h.01" />',
    'store-front': '<path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" /><path d="M12 3v6" />',
    'shopping-cart-off': '<circle cx="9" cy="21" r="1" /><path d="M10 12.5 2.5 2.5" /><path d="M3.29 3.29 7 12.38 8 17a2 2 0 0 0 2 2h8" /><path d="m16 15.5-.5-2.5H9" /><circle cx="20" cy="21" r="1" /><path d="m2 2 20 20" />',
    'tag-x': '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" /><path d="M7 7h.01" /><path d="m13.5 10.5-5 5" /><path d="m8.5 10.5 5 5" />',
    'tags': '<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19" /><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8 18" /><path d="M6.5 8.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" /><path d="M10 16 4.72 21.28a1 1 0 0 0 .7 1.72H10l6-6" />',

    // Nature & Ecology
    'tree-pine': '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14l-3-3.3a1 1 0 0 1 .7-1.7h3.6L6 6.3a1 1 0 0 1 .7-1.7h10.6a1 1 0 0 1 .7 1.7L16 9h3.6a1 1 0 0 1 .7 1.7L17 14Z" /><path d="M12 22v-3" />',
    'tree-deciduous': '<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z" /><path d="M12 19v3" />',
    'tree-palm': '<path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4" /><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3" /><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 4.24-4.24c1.96 1.96 1.8 5.29-.35 7.43" /><path d="M12 20v-9.5" />',
    'flower': '<circle cx="12" cy="12" r="3" /><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5" /><path d="M12 7.5V9" /><path d="M7.5 12H9" /><path d="M16.5 12H15" /><path d="M12 16.5V15" /><path d="m8 8 1.88 1.88" /><path d="M14.12 9.88 16 8" /><path d="m8 16 1.88-1.88" /><path d="M14.12 14.12 16 16" />',
    'flower-2': '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1" /><circle cx="12" cy="8" r="2" /><path d="M12 10v12" /><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z" /><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z" />',
    'clover': '<path d="M16.17 7.83 2 22" /><path d="M4.02 12a2.827 2.827 0 1 1 3.81-4.17A2.827 2.827 0 1 1 12 4.02a2.827 2.827 0 1 1 4.17 3.81A2.827 2.827 0 1 1 19.98 12a2.827 2.827 0 1 1-3.81 4.17A2.827 2.827 0 1 1 12 19.98a2.827 2.827 0 1 1-4.17-3.81A2.827 2.827 0 1 1 4.02 12Z" />',
    'mushroom': '<path d="M2 22a1 1 0 0 1-1-1v-2a5 5 0 0 1 5-5h12a5 5 0 0 1 5 5v2a1 1 0 0 1-1 1H2Z" /><path d="M12 14V9" /><path d="M5.07 14.12A7 7 0 0 1 12 2a7 7 0 0 1 6.93 12.12" />',
    'mountain-snow': '<path d="m8 3 4 8 5-5 5 15H2z" /><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" />',
    'waves': '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />',
    'cloud-off': '<path d="m2 2 20 20" /><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" /><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />',
    'haze': '<path d="m5.2 6.2 1.4 1.4" /><path d="M2 13h2" /><path d="M20 13h2" /><path d="m17.4 7.6 1.4-1.4" /><path d="M22 17H2" /><path d="M22 21H2" /><path d="M16 13a4 4 0 0 0-8 0" /><path d="M12 5V2.5" />',
    'sun-moon': '<path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.3 17.7-1.4 1.4" /><path d="m19.1 4.9-1.4 1.4" />',
    'sun-dim': '<circle cx="12" cy="12" r="4" /><path d="M12 4h.01" /><path d="M20 12h.01" /><path d="M12 20h.01" /><path d="M4 12h.01" /><path d="M17.657 6.343h.01" /><path d="M17.657 17.657h.01" /><path d="M6.343 17.657h.01" /><path d="M6.343 6.343h.01" />',
    'cloud-hail': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 14v2" /><path d="M8 14v2" /><path d="M16 20h.01" /><path d="M8 20h.01" /><path d="M12 16v2" /><path d="M12 22h.01" />',

    // Transport & Vehicles extended
    'car-front': '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" /><path d="M7 14h.01" /><path d="M17 14h.01" /><rect width="18" height="8" x="3" y="10" rx="2" /><path d="M5 18v2" /><path d="M19 18v2" />',
    'car-taxi-front': '<path d="M10 2h4" /><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" /><path d="M7 14h.01" /><path d="M17 14h.01" /><rect width="18" height="8" x="3" y="10" rx="2" /><path d="M5 18v2" /><path d="M19 18v2" />',
    'ambulance': '<path d="M10 10H6" /><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14" /><path d="M8 8v4" /><circle cx="7" cy="18" r="2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" />',
    'tractor': '<path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20" /><path d="M16 18h-5" /><path d="M18 5a1 1 0 0 0-1 1v5.573" /><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246" /><path d="M4 11V4" /><circle cx="18" cy="18" r="2" /><circle cx="7" cy="15" r="5" />',
    'sailboat': '<path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z" /><path d="M21 14 10 2 3 14h18Z" /><path d="M10 2v16" />',
    'ferry': '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" /><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" /><path d="M12 1v4" />',
    'rocket-launch': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />',
    'cable-car': '<path d="M10 3h.01" /><path d="M14 2h.01" /><path d="m2 9 20-5" /><path d="M12 12V6.5" /><rect width="16" height="10" x="4" y="12" rx="3" />',
    'bike-electric': '<circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /><path d="M10 3h2.5" />',
    'forklift': '<path d="M5 11V8a2 2 0 0 0-2-2h0" /><path d="M10 22V8" /><path d="M3 22h2" /><path d="M10 22h4a2 2 0 0 0 2-2v-2" /><path d="M14 13V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v7" /><path d="M8 22h.01" /><circle cx="18" cy="18" r="3" />',

    // Sport & Fitness
    'goal': '<path d="M12 13V2l8 4-8 4" /><path d="M20.55 10.23A9 9 0 1 1 8 2.94" /><path d="M8 10a5 5 0 1 0 8.9 2.02" />',
    'tennis-ball': '<circle cx="12" cy="12" r="10" /><path d="M18.09 5.91A5.987 5.987 0 0 0 12 14a5.987 5.987 0 0 0-6.09 4.09" /><path d="M5.91 5.91A5.987 5.987 0 0 1 12 10a5.987 5.987 0 0 1 6.09-4.09" />',
    'dribbble': '<circle cx="12" cy="12" r="10" /><path d="M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94" /><path d="M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32" /><path d="M8.56 2.75c4.37 6 6 9.42 8 17.72" />',
    'swords': '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" /><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" /><line x1="5" x2="9" y1="14" y2="18" /><line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" />',
    'footprints': '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" /><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" /><path d="M16 17h4" /><path d="M4 13h4" />',
    'bike-mountain': '<path d="M12 18V2" /><path d="m7 8 5-6" /><path d="m17 8-5-6" /><circle cx="5" cy="17" r="3" /><circle cx="19" cy="17" r="3" /><path d="m12 12-4 5h8Z" />',

    // Home & Furniture
    'sofa': '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" /><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z" /><path d="M4 18v2" /><path d="M20 18v2" /><path d="M12 4v9" />',
    'bed': '<path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" />',
    'door-open': '<path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" /><path d="M10 12v.01" /><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />',
    'door-closed': '<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" /><path d="M2 20h20" /><path d="M14 12v.01" />',
    'bath': '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /><line x1="10" x2="8" y1="5" y2="7" /><line x1="2" x2="22" y1="12" y2="12" /><line x1="7" x2="7" y1="19" y2="21" /><line x1="17" x2="17" y1="19" y2="21" />',
    'lamp-ceiling': '<path d="M12 2v5" /><path d="M6 7h12l4 9H2l4-9Z" /><path d="M9.17 16a3 3 0 1 0 5.66 0" />',
    'lamp-floor': '<path d="M9 2h6l3 7H6l3-7Z" /><path d="M12 9v13" /><path d="M9 22h6" />',
    'armchair': '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" /><path d="M3 16h18" /><path d="M2 11v5a2 2 0 0 0 2 2" /><path d="M20 18a2 2 0 0 0 2-2v-5" /><path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5H4v-5Z" /><path d="M4 18v2" /><path d="M20 18v2" />',
    'cooking-pot': '<path d="M2 12h20" /><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" /><path d="m4 8 16-4" /><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8" />',
    'washing-machine': '<path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Z" /><path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M8 5h.01" /><path d="M11 5h2" />',
    'microwave': '<rect width="20" height="15" x="2" y="4" rx="2" /><rect width="8" height="7" x="6" y="8" rx="1" /><path d="M18 8v7" /><path d="M6 19v2" /><path d="M18 19v2" />',

    // Medical & Health extended
    'ambulance-siren': '<path d="M10 10H6" /><path d="M8 8v4" /><path d="M12 2v2" /><path d="M7 4h10" /><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14" /><circle cx="7" cy="18" r="2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" />',
    'brain': '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M17.599 6.5a3 3 0 0 0 .399-1.375" /><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" /><path d="M3.477 10.896a4 4 0 0 1 .585-.396" /><path d="M19.938 10.5a4 4 0 0 1 .585.396" /><path d="M6 18a4 4 0 0 1-1.967-.516" /><path d="M19.967 17.484A4 4 0 0 1 18 18" />',
    'heart-off': '<line x1="2" x2="22" y1="2" y2="22" /><path d="M16.5 16.5 12 21l-7-7c-1.5-1.45-3-3.2-3-5.5a5.5 5.5 0 0 1 2.14-4.35" /><path d="M8.76 3.1c1.15.22 2.13.78 3.24 1.9 1.5-1.5 2.74-2 4.5-2A5.5 5.5 0 0 1 22 8.5c0 2.12-1.3 3.78-2.67 5.17" />',
    'activity-square': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M17 12h-2l-2 5-2-10-2 5H7" />',
    'scan-heart': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M12 16.438c-1.312-1.312-2.876-2.104-2.876-3.876a2.632 2.632 0 0 1 5.251 0c0 1.772-1.563 2.564-2.876 3.876Z" />',
    'stethoscope-alt': '<path d="M11 2v2" /><path d="M5 2v2" /><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" /><path d="M8 15a6 6 0 0 0 12 0v-3" /><circle cx="20" cy="10" r="2" />',
    'hospital': '<path d="M12 6v4" /><path d="M14 14h-4" /><path d="M14 18h-4" /><path d="M14 8h-4" /><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2" /><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18" />',
    'band-aid': '<path d="M18 2 2 18" /><path d="m22 6-4-4" /><path d="m6 22-4-4" /><path d="m2 2 20 20" /><path d="M22 18 18 22" /><path d="M6 2 2 6" /><path d="M10 10h.01" /><path d="M14 14h.01" />',

    // Education extended
    'school': '<path d="M14 22v-4a2 2 0 1 0-4 0v4" /><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" /><path d="M18 5v17" /><path d="m4 6 8-4 8 4" /><path d="M6 5v17" /><circle cx="12" cy="9" r="2" />',
    'backpack': '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" /><path d="M8 10h8" /><path d="M8 18h8" />',
    'pen-tool': '<path d="m12 19 7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="m2 2 7.586 7.586" /><circle cx="11" cy="11" r="2" />',
    'pencil-ruler': '<path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13" /><path d="m8 6 2-2" /><path d="m18 16 2-2" /><path d="m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17" /><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />',
    'presentation': '<path d="M2 3h20" /><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" /><path d="m7 21 5-5 5 5" />',
    'library': '<path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" />',

    // Gaming & Fun
    'dice-1': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M12 12h.01" />',
    'dice-2': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M15 9h.01" /><path d="M9 15h.01" />',
    'dice-3': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M12 12h.01" /><path d="M8 16h.01" />',
    'dice-4': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M8 8h.01" /><path d="M8 16h.01" /><path d="M16 16h.01" />',
    'dice-5': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M8 8h.01" /><path d="M8 16h.01" /><path d="M16 16h.01" /><path d="M12 12h.01" />',
    'dice-6': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M16 12h.01" /><path d="M16 16h.01" /><path d="M8 8h.01" /><path d="M8 12h.01" /><path d="M8 16h.01" />',
    'puzzle': '<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707 2.402 2.402 0 0 1 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />',
    'joystick': '<path d="M21 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2Z" /><path d="M6 15v-2" /><path d="M12 15V9" /><circle cx="12" cy="6" r="3" />',
    'ghost': '<path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />',
    'worm': '<path d="m19 12-1.5 3" /><path d="M19.63 18.81 22 20" /><path d="M6.47 8.23a1.68 1.68 0 0 1 2.44-1.93l.64.42a.97.97 0 0 0 1.26-.13L12 5.4a2 2 0 0 1 3 .53l.26.53a2 2 0 0 0 2.26 1.06L21 6.4" /><path d="M5.2 16.3A3.34 3.34 0 0 0 2 19.5 3.34 3.34 0 0 0 5.5 22a3.33 3.33 0 0 0 3-2.7" /><path d="m10.2 14.5 3.3-2.5" />',
    'candy': '<path d="m9.5 7.5-2 2a4.95 4.95 0 1 0 7 7l2-2a4.95 4.95 0 1 0-7-7Z" /><path d="M14 6.5v10" /><path d="M10 7.5v10" /><path d="m16 7 1-5 1.37.68A3 3 0 0 0 19.7 3H21v1.3c0 .46.1.92.32 1.33L22 7l-5 1" /><path d="m8 17-1 5-1.37-.68A3 3 0 0 0 4.3 21H3v-1.3a3 3 0 0 0-.32-1.33L2 17l5-1" />',

    // Accessibility & Identity
    'ear': '<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" /><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />',
    'ear-off': '<path d="M6 18.5a3.5 3.5 0 1 0 7 0c0-1.57.92-2.52 2.04-3.46" /><path d="M6 8.5c0-.75.13-1.47.36-2.14" /><path d="M8.8 3.15A6.5 6.5 0 0 1 19 8.5c0 1.63-.44 2.81-1.09 3.76" /><path d="M12.5 6A2.5 2.5 0 0 1 15 8.5M10 13a2 2 0 0 0 1.82-1.18" /><line x1="2" x2="22" y1="2" y2="22" />',
    'eye-closed': '<path d="m15 18-.722-3.25" /><path d="M2 8a10.645 10.645 0 0 0 20 0" /><path d="m20 15-1.726-2.05" /><path d="m4 15 1.726-2.05" /><path d="m9 18 .722-3.25" />',
    'glasses': '<circle cx="6" cy="15" r="4" /><circle cx="18" cy="15" r="4" /><path d="M14 15a2 2 0 0 0-4 0" /><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2" /><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2" />',
    'wheelchair': '<circle cx="12" cy="12" r="10" /><circle cx="9" cy="9" r="1.5" /><path d="M9 13a4 4 0 0 0 7.47 2" /><path d="m7.5 10.5 3 1.5 2-2" />',
    'speech': '<path d="M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-1.063l.634-.951A2.3 2.3 0 0 1 15.4 13H17" /><path d="M19 13a4 4 0 0 0-4-4H9a4 4 0 0 0 0 8h.2" /><path d="M2 16a3 3 0 0 1 2.83-3" />',

    // Misc Utilities
    'copy-check': '<path d="m12 15 2 2 4-4" /><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    'copy-minus': '<line x1="12" x2="18" y1="15" y2="15" /><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    'copy-plus': '<line x1="15" x2="15" y1="12" y2="18" /><line x1="12" x2="18" y1="15" y2="15" /><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    'copy-x': '<line x1="12" x2="18" y1="12" y2="18" /><line x1="12" x2="18" y1="18" y2="12" /><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />',
    'clipboard-copy': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M16 4h2a2 2 0 0 1 2 2v4" /><path d="M21 14H11" /><path d="m15 10-4 4 4 4" />',
    'trash-x': '<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="14" y1="11" y2="17" /><line x1="14" x2="10" y1="11" y2="17" />',
    'archive-x': '<rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="m9.5 17 2.5-2.5 2.5 2.5" /><path d="m9.5 12 2.5 2.5 2.5-2.5" />',
    'archive-restore': '<rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="m9.5 17 2.5-2.5 2.5 2.5" /><path d="M12 14.5V12" />',
    'save-all': '<path d="M10 2v3a1 1 0 0 0 1 1h5" /><path d="M18 18v-6a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6" /><path d="M18 22H4a2 2 0 0 1-2-2V6" /><path d="M8 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 22 6.828V16a2 2 0 0 1-2 2" />',
    'bookmark-check': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" /><path d="m9 10 2 2 4-4" />',
    'bookmark-minus': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11" /><line x1="15" x2="9" y1="10" y2="10" />',
    'bookmark-x': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11" /><path d="m14.5 7.5-5 5" /><path d="m9.5 7.5 5 5" />',
    'link-2': '<path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" x2="16" y1="12" y2="12" />',
    'link-2-off': '<path d="M9 17H7A5 5 0 0 1 7 7" /><path d="M15 7h2a5 5 0 0 1 4 8" /><line x1="8" x2="12" y1="12" y2="12" /><line x1="2" x2="22" y1="2" y2="22" />',
    'parentheses': '<path d="M8 21s-4-3-4-9 4-9 4-9" /><path d="M16 3s4 3 4 9-4 9-4 9" />',
    'sigma-square': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M16 8H8l4 4-4 4h8" />',
    'pi': '<line x1="9" x2="9" y1="4" y2="20" /><path d="M4 7c0-1.7 1.3-3 3-3h13" /><path d="M18 20c-1.7 0-3-1.3-3-3V4" />',
    'whole-word': '<circle cx="7" cy="12" r="3" /><path d="M10 9v6" /><circle cx="17" cy="12" r="3" /><path d="M14 7v8" /><path d="M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1" />',
    'spell-check-2': '<path d="m6 16 6-12 6 12" /><path d="M8 12h8" /><path d="M4 21c1.1 0 1.1-1 2.3-1s1.1 1 2.3 1c1.1 0 1.1-1 2.3-1 1.1 0 1.1 1 2.3 1 1.1 0 1.1-1 2.3-1 1.1 0 1.1 1 2.3 1" />',
    'text-select': '<path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" /><line x1="7" x2="15" y1="8" y2="8" /><line x1="7" x2="17" y1="12" y2="12" /><line x1="7" x2="13" y1="16" y2="16" />',
    'text-cursor-input': '<path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1" /><path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5" /><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1" /><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7" /><path d="M9 7v10" />',
    'between-horizontal-start': '<rect width="13" height="7" x="8" y="3" rx="1" /><rect width="13" height="7" x="8" y="14" rx="1" /><path d="M4 7h3" /><path d="M4 17h3" /><path d="M2 12h6" />',
    'between-horizontal-end': '<rect width="13" height="7" x="3" y="3" rx="1" /><rect width="13" height="7" x="3" y="14" rx="1" /><path d="M17 7h3" /><path d="M17 17h3" /><path d="M16 12h6" />',
    'split': '<path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />',
    'merge': '<path d="m8 6 4-4 4 4" /><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" /><path d="m20 22-5-5" />',
    'workflow': '<rect width="8" height="8" x="3" y="3" rx="2" /><path d="M7 11v4a2 2 0 0 0 2 2h4" /><rect width="8" height="8" x="13" y="13" rx="2" />',
    'orbit': '<circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><path d="M10.4 21.9a10 10 0 0 0 9.941-15.416" /><path d="M13.5 2.1a10 10 0 0 0-9.841 15.416" />',
    'waypoints': '<circle cx="12" cy="4.5" r="2.5" /><path d="m10.2 6.3-3.9 3.9" /><circle cx="4.5" cy="12" r="2.5" /><path d="M7 12h10" /><circle cx="19.5" cy="12" r="2.5" /><path d="m13.8 17.7 3.9-3.9" /><circle cx="12" cy="19.5" r="2.5" />',
    'network': '<rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="9" y="2" width="6" height="6" rx="1" /><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" /><path d="M12 12V8" />',
    'screen-share': '<path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" /><path d="M8 21h8" /><path d="M12 17v4" /><path d="m17 8 5-5" /><path d="M17 3h5v5" />',
    'screen-share-off': '<path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" /><path d="M8 21h8" /><path d="M12 17v4" /><path d="m22 3-5 5" /><path d="m17 3 5 5" />',
    'qr-code-scan': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><rect width="5" height="5" x="7" y="7" rx="1" /><rect width="5" height="5" x="12" y="12" rx="1" /><path d="M12 7h5v5" />',
    'nfc': '<path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" /><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" /><path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" /><path d="M16.37 2a20.16 20.16 0 0 1 0 20" />',
    'bug-off': '<path d="M15 7.13V6a3 3 0 0 0-5.14-2.1L8 2" /><path d="M14.12 3.88 16 2" /><path d="M22 13h-4v-2a4 4 0 0 0-4-4h-1.3" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="m2 2 20 20" /><path d="M7.7 7.7A4 4 0 0 0 6 11v3a6 6 0 0 0 11.13 3.13" /><path d="M12 20v-8" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" />',
    'bug-play': '<path d="M16 2c.97 1.04 1 3.08 0 4l-2 .83V8" /><path d="M8 2c-.97 1.04-1 3.08 0 4l2 .83V8" /><path d="M2 13h4" /><path d="M22 13h-4" /><path d="M12 20v-4" /><path d="M3.27 18.54C5.15 20.82 8.1 22 12 22c3.9 0 6.85-1.18 8.73-3.46" /><path d="M6 12v-2a6 6 0 0 1 12 0v2" /><path d="m10 15 2 2 2-2" />',
    'test-tubes': '<path d="M9 2v17.5A2.5 2.5 0 0 1 6.5 22A2.5 2.5 0 0 1 4 19.5V2" /><path d="M20 2v17.5a2.5 2.5 0 0 1-2.5 2.5A2.5 2.5 0 0 1 15 19.5V2" /><path d="M3 2h7" /><path d="M14 2h7" /><path d="M9 16H4" /><path d="M20 16h-5" />',
    'construction': '<rect x="2" y="6" width="20" height="8" rx="1" /><path d="M17 14v7" /><path d="M7 14v7" /><path d="M17 3v3" /><path d="M7 3v3" /><path d="M10 14 2.3 6.3" /><path d="m14 6 7.7 7.7" /><path d="m8 6 8 8" />',
    'hard-hat': '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" /><path d="M10 15V7a2 2 0 0 1 4 0v8" /><path d="M5 15V9a7 7 0 0 1 14 0v6" />',
    'cone': '<path d="m20.9 18.55-8-15.98a1 1 0 0 0-1.8 0l-8 15.98" /><ellipse cx="12" cy="19" rx="9" ry="3" />',
    'shovel': '<path d="M2 22v-5l5-5 5 5-5 5z" /><path d="M9.5 14.5 16 8" /><path d="m17 2 5 5-.5.5a3.53 3.53 0 0 1-5 0s0 0 0 0a3.53 3.53 0 0 1 0-5L17 2" />',
    'brick-wall': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 9v6" /><path d="M16 15v6" /><path d="M16 3v6" /><path d="M3 15h18" /><path d="M3 9h18" /><path d="M8 15v6" /><path d="M8 3v6" />',
    'blocks': '<rect width="7" height="7" x="14" y="3" rx="1" /><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" />',
    'component': '<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z" /><path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z" /><path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z" /><path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z" />',
    'shapes': '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" /><rect x="3" y="14" width="7" height="7" rx="1" /><circle cx="17.5" cy="17.5" r="3.5" />',
} as const;

/** @deprecated Use DEFAULT_ICONS instead */
export const ICONS = DEFAULT_ICONS;

export type DefaultIconName = keyof typeof DEFAULT_ICONS;

export type IconName = DefaultIconName | (string & Record<never, never>);

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | (string & Record<never, never>);

export type IconWeight = 'light' | 'regular' | 'thick' | 'solid';

export const SOLID_SUPPORTED_ICONS: ReadonlySet<string> = new Set([
    'heart', 'heart-crack', 'star', 'bookmark', 'bookmark-plus', 'flag', 'circle', 'circle-dot',
    'shield', 'shield-check', 'shield-alert', 'moon', 'cloud', 'zap',
    'message-square', 'message-circle', 'message-square-plus', 'play', 'filter',
    'folder', 'folder-plus', 'map-pin', 'tag', 'thumbs-up', 'thumbs-down',
    'bell', 'bell-ring', 'home', 'lock', 'unlock', 'mail', 'mail-open', 'file',
    'file-text', 'file-plus', 'camera', 'credit-card',
    'alert-triangle', 'gift', 'box', 'compass', 'navigation',
    'shopping-bag', 'droplet', 'hexagon', 'diamond', 'octagon',
    'square', 'triangle', 'pentagon', 'crown', 'badge-check', 'thermometer',
    'heart-pulse', 'flame', 'leaf', 'mountain', 'tent',
    'apple', 'cherry', 'fish',
    'arrow-big-up', 'arrow-big-down', 'arrow-big-left', 'arrow-big-right',
    'gem', 'stamp', 'circle-check', 'circle-x', 'circle-alert', 'circle-plus',
    'circle-minus', 'circle-pause', 'circle-play', 'circle-stop',
]);

const SIZE_MAP: Record<string, string> = {
    xs: '12',
    sm: '16',
    md: '24',
    lg: '32',
    xl: '48',
};

@Component({
    selector: 'ui-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            [attr.width]="resolvedSize()"
            [attr.height]="resolvedSize()"
            viewBox="0 0 24 24"
            [attr.fill]="resolvedFill()"
            [attr.stroke]="resolvedStroke()"
            [attr.stroke-width]="resolvedStrokeWidth()"
            stroke-linecap="round"
            stroke-linejoin="round"
            [class]="classes()"
            [innerHTML]="svgContent()"
            [attr.data-slot]="'icon'"
            [style.color]="color() || null"
        ></svg>
    `,
    styles: [`:host { display: inline-flex; }`],
})
export class IconComponent {
    readonly name = input<IconName>('');
    readonly class = input('');
    readonly size = input<IconSize>('md');
    readonly weight = input<IconWeight>('regular');
    readonly strokeWidth = input<number | undefined>(undefined);
    readonly color = input<string>();
    readonly fillColor = input<string>();

    private readonly sanitizer = inject(DomSanitizer);
    private readonly customIcons = inject(UI_CUSTOM_ICONS, { optional: true });

    private readonly mergedIcons: Record<string, string> = {
        ...DEFAULT_ICONS,
        ...(this.customIcons ?? {}),
    };

    readonly resolvedSize = computed(() => {
        const s = this.size();
        return SIZE_MAP[s] ?? s;
    });

    readonly resolvedWeight = computed(() => {
        const w = this.weight();
        if (w === 'solid' && !SOLID_SUPPORTED_ICONS.has(this.name())) {
            return 'regular';
        }
        return w;
    });

    readonly resolvedStrokeWidth = computed(() => {
        const custom = this.strokeWidth();
        if (custom !== undefined) return String(custom);
        const w = this.resolvedWeight();
        if (w === 'light') return '1.5';
        if (w === 'thick') return '2.5';
        if (w === 'solid') return '0';
        return '2';
    });

    readonly resolvedFill = computed(() => {
        const fc = this.fillColor();
        if (fc) return fc;
        return this.resolvedWeight() === 'solid' ? 'currentColor' : 'none';
    });

    readonly resolvedStroke = computed(() =>
        this.resolvedWeight() === 'solid' ? 'none' : 'currentColor',
    );

    readonly svgContent = computed(() => {
        const iconName = this.name();
        const rawHtml = this.mergedIcons[iconName] ?? '';
        return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
    });

    readonly classes = computed(() =>
        cn(
            'ui-icon',
            this.name() ? `ui-icon-${this.name()}` : 'ui-icon-icon',
            this.class(),
        ),
    );
}
