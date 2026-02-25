/**
 * Balloon Number Integrity Utilities
 *
 * Ensures balloon numbers are always sequential, unique, and
 * ordered by position (top→bottom, left→right) on the drawing.
 */

import type { PDFOverlayItem } from '@/types'

const BALLOON_TYPES: PDFOverlayItem['type'][] = ['comment', 'issue', 'callout']

/** Check whether an overlay item is a balloon type */
export function isBalloon(item: PDFOverlayItem): boolean {
    return BALLOON_TYPES.includes(item.type)
}

/**
 * Resequence all balloon items 1..N by their Y position (top to bottom),
 * then X (left to right). Non-balloon items are returned unchanged.
 * Call this after EVERY add / delete / reorder operation.
 */
export function resequenceBalloons(items: PDFOverlayItem[]): PDFOverlayItem[] {
    const balloons: PDFOverlayItem[] = []
    const others: PDFOverlayItem[] = []

    for (const item of items) {
        if (isBalloon(item)) {
            balloons.push(item)
        } else {
            others.push(item)
        }
    }

    // Sort by page first, then Y (top to bottom), then X (left to right)
    balloons.sort((a, b) => {
        const pageA = a.page ?? 1
        const pageB = b.page ?? 1
        if (pageA !== pageB) return pageA - pageB

        const yA = a.points[0]?.y ?? 0
        const yB = b.points[0]?.y ?? 0
        if (Math.abs(yA - yB) > 0.02) return yA - yB // ~2% tolerance for same row

        const xA = a.points[0]?.x ?? 0
        const xB = b.points[0]?.x ?? 0
        return xA - xB
    })

    // Assign sequential numbers
    const resequenced = balloons.map((item, idx) => ({
        ...item,
        balloonNo: idx + 1,
    }))

    return [...resequenced, ...others]
}

/**
 * Check for duplicate balloonNo — throws with message listing duplicates.
 */
export function validateBalloonNumbers(items: PDFOverlayItem[]): void {
    const balloons = items.filter(isBalloon)
    const seen = new Map<number, string[]>()

    for (const b of balloons) {
        if (b.balloonNo == null) continue
        const existing = seen.get(b.balloonNo) || []
        existing.push(b.id)
        seen.set(b.balloonNo, existing)
    }

    const duplicates: string[] = []
    seen.forEach((ids, num) => {
        if (ids.length > 1) {
            duplicates.push(`Balloon #${num} (${ids.length} items)`)
        }
    })

    if (duplicates.length > 0) {
        throw new Error(`Duplicate balloon numbers detected: ${duplicates.join(', ')}`)
    }
}

/**
 * Get next available balloonNo (max + 1).
 */
export function nextBalloonNo(items: PDFOverlayItem[]): number {
    const maxNo = items
        .filter(isBalloon)
        .reduce((max, item) => Math.max(max, item.balloonNo ?? 0), 0)
    return maxNo + 1
}

/**
 * Count duplicate balloon numbers in items.
 * Returns 0 if no duplicates.
 */
export function countDuplicateBalloons(items: PDFOverlayItem[]): number {
    const balloons = items.filter(isBalloon)
    const counts = new Map<number, number>()

    for (const b of balloons) {
        if (b.balloonNo == null) continue
        counts.set(b.balloonNo, (counts.get(b.balloonNo) || 0) + 1)
    }

    let dupeCount = 0
    counts.forEach((count) => {
        if (count > 1) dupeCount += count - 1
    })

    return dupeCount
}
