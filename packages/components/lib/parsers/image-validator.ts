const SVG_CHECK_LENGTH = 256;

function isJpeg(b: Uint8Array): boolean {
    return b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
}

function isPng(b: Uint8Array): boolean {
    return b.length >= 8 &&
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
        b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A;
}

function isGif(b: Uint8Array): boolean {
    return b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
}

function isWebp(b: Uint8Array): boolean {
    return b.length >= 12 &&
        b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
}

export function isValidImageMagicBytes(bytes: Uint8Array): boolean {
    if (bytes.length < 3) return false;
    return isJpeg(bytes) || isPng(bytes) || isGif(bytes) || isWebp(bytes) || isSvgContent(bytes);
}

function isSvgContent(bytes: Uint8Array): boolean {
    let offset = 0;
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        offset = 3;
    }
    const length = Math.min(bytes.length, SVG_CHECK_LENGTH);
    let text = '';
    for (let i = offset; i < length; i++) {
        text += String.fromCodePoint(bytes[i]);
    }
    const trimmed = text.trimStart().toLowerCase();
    return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
}

export function isValidImageDataUrl(dataUrl: string): boolean {
    const lower = dataUrl.toLowerCase();
    if (!lower.startsWith('data:image/')) return false;

    const base64Marker = ';base64,';
    const markerIndex = lower.indexOf(base64Marker);
    if (markerIndex === -1) return false;

    const base64Start = markerIndex + base64Marker.length;

    if (lower.startsWith('data:image/svg+xml')) {
        const svgChunk = dataUrl.substring(base64Start, base64Start + 344);
        if (!svgChunk) return false;
        try {
            const decoded = atob(svgChunk);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.codePointAt(i) ?? 0;
            }
            return isSvgContent(bytes);
        } catch {
            return false;
        }
    }

    const chunk = dataUrl.substring(base64Start, base64Start + 16);
    if (!chunk) return false;
    try {
        const decoded = atob(chunk);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.codePointAt(i) ?? 0;
        }
        return isValidImageMagicBytes(bytes);
    } catch {
        return false;
    }
}
