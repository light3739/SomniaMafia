export const BASE_WIDTH = 1488;
export const BASE_HEIGHT = 1024;

const HAND_TUNED: Record<number, { x: number; y: number }[]> = {
    3: [{ x: 619, y: 38 }, { x: 1050, y: 800 }, { x: 188, y: 800 }],
    4: [{ x: 1082, y: 106 }, { x: 1105, y: 786 }, { x: 177, y: 792 }, { x: 178, y: 100 }],
    5: [{ x: 619, y: 38 }, { x: 1178, y: 290 }, { x: 1000, y: 800 }, { x: 238, y: 800 }, { x: 60, y: 290 }],
    6: [{ x: 619, y: 58 }, { x: 1124, y: 214 }, { x: 1145, y: 670 }, { x: 619, y: 836 }, { x: 96, y: 660 }, { x: 90, y: 214 }],
    7: [{ x: 619, y: 38 }, { x: 1166, y: 164 }, { x: 1198, y: 558 }, { x: 913, y: 856 }, { x: 325, y: 856 }, { x: 61, y: 561 }, { x: 101, y: 165 }],
    8: [{ x: 619, y: 38 }, { x: 1120, y: 114 }, { x: 1208, y: 447 }, { x: 1150, y: 796 }, { x: 619, y: 856 }, { x: 147, y: 803 }, { x: 48, y: 449 }, { x: 141, y: 114 }],
    9: [{ x: 619, y: 38 }, { x: 1058, y: 103 }, { x: 1229, y: 376 }, { x: 1181, y: 677 }, { x: 831, y: 831 }, { x: 407, y: 831 }, { x: 57, y: 677 }, { x: 9, y: 376 }, { x: 180, y: 103 }],
    10: [{ x: 810, y: 58 }, { x: 1160, y: 177 }, { x: 1238, y: 447 }, { x: 1160, y: 717 }, { x: 810, y: 836 }, { x: 428, y: 836 }, { x: 78, y: 717 }, { x: 0, y: 447 }, { x: 78, y: 177 }, { x: 428, y: 58 }],
    11: [{ x: 619, y: 38 }, { x: 1013, y: 60 }, { x: 1207, y: 262 }, { x: 1217, y: 507 }, { x: 1149, y: 759 }, { x: 793, y: 839 }, { x: 445, y: 839 }, { x: 82, y: 754 }, { x: 27, y: 505 }, { x: 31, y: 262 }, { x: 227, y: 63 }],
    12: [{ x: 779, y: 52 }, { x: 1102, y: 125 }, { x: 1217, y: 341 }, { x: 1217, y: 553 }, { x: 1102, y: 769 }, { x: 779, y: 842 }, { x: 459, y: 842 }, { x: 136, y: 769 }, { x: 21, y: 553 }, { x: 21, y: 341 }, { x: 136, y: 125 }, { x: 459, y: 52 }],
    13: [{ x: 619, y: 38 }, { x: 1000, y: 58 }, { x: 1210, y: 230 }, { x: 1230, y: 447 }, { x: 1210, y: 664 }, { x: 1000, y: 836 }, { x: 619, y: 856 }, { x: 238, y: 836 }, { x: 28, y: 664 }, { x: 8, y: 447 }, { x: 28, y: 230 }, { x: 238, y: 58 }],
    14: [{ x: 778, y: 46 }, { x: 1104, y: 76 }, { x: 1212, y: 267 }, { x: 1238, y: 447 }, { x: 1212, y: 627 }, { x: 1104, y: 818 }, { x: 778, y: 848 }, { x: 460, y: 848 }, { x: 134, y: 818 }, { x: 26, y: 627 }, { x: 0, y: 447 }, { x: 26, y: 267 }, { x: 134, y: 76 }, { x: 460, y: 46 }],
    15: [{ x: 619, y: 36 }, { x: 909, y: 37 }, { x: 1187, y: 170 }, { x: 1233, y: 347 }, { x: 1232, y: 512 }, { x: 1200, y: 688 }, { x: 1053, y: 848 }, { x: 759, y: 860 }, { x: 479, y: 860 }, { x: 185, y: 848 }, { x: 38, y: 688 }, { x: 6, y: 512 }, { x: 5, y: 347 }, { x: 51, y: 170 }, { x: 329, y: 37 }],
    16: [{ x: 51, y: 89 }, { x: 335, y: 38 }, { x: 619, y: 38 }, { x: 903, y: 38 }, { x: 1187, y: 89 }, { x: 1238, y: 256 }, { x: 1238, y: 443 }, { x: 1238, y: 630 }, { x: 1187, y: 804 }, { x: 903, y: 855 }, { x: 619, y: 855 }, { x: 335, y: 855 }, { x: 51, y: 804 }, { x: 0, y: 630 }, { x: 0, y: 443 }, { x: 0, y: 256 }],
};

export function getPlayerPositions(count: number): { id: string; x: number; y: number }[] {
    if (count === 0) return [];
    const isMobilePortrait = typeof window !== 'undefined' && window.innerWidth < 768 && window.innerHeight > window.innerWidth;

    const tuned = HAND_TUNED[count];
    if (tuned) {
        return tuned.map((p, i) => {
            let x = p.x;
            let y = p.y;
            if (isMobilePortrait) {
                const center = 744;
                const offset = x - center;
                if (Math.abs(offset) > 300) x = center + (offset * 0.65);
            }
            return { id: `p${i + 1}`, x, y };
        });
    }

    const CARD_W = 250, CARD_H = 130;
    const maxX = BASE_WIDTH - CARD_W;
    const maxY = BASE_HEIGHT - CARD_H;
    const margin = 38, left = 0, right = maxX, top = margin, bottom = maxY - margin;
    const topLen = right - left, rightLen = bottom - top, bottomLen = right - left, leftLen = bottom - top;
    const totalPerimeter = topLen + rightLen + bottomLen + leftLen;
    const step = totalPerimeter / count;
    const startOffset = (topLen / 2);

    const positions: { id: string; x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
        let d = (startOffset + i * step) % totalPerimeter;
        let x: number, y: number;
        if (d < topLen) { x = left + d; y = top; }
        else if (d < topLen + rightLen) { d -= topLen; x = right; y = top + d; }
        else if (d < topLen + rightLen + bottomLen) { d -= topLen + rightLen; x = right - d; y = bottom; }
        else { d -= topLen + rightLen + bottomLen; x = left; y = bottom - d; }
        positions.push({ id: `p${i + 1}`, x: Math.round(x), y: Math.round(y) });
    }
    return positions;
}
