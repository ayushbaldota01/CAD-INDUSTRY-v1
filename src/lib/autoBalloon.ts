/**
 * Auto-Balloon Engine
 *
 * Extracts text from vector PDFs via pdfjs-dist, merges fragmented items,
 * classifies them against engineering patterns, deduplicates by proximity,
 * and returns positioned overlay items ready for placement.
 */

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFOverlayItem, PDFOverlayEntityType } from '@/types'

// Ensure worker is set (same as PdfAnnotator)
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTextItem {
    text: string
    x: number        // normalized 0..1
    y: number        // normalized 0..1
    width: number     // normalized
    height: number    // normalized
    page: number
    rawX: number      // pixel position
    rawY: number      // pixel position
    rawW: number
    rawH: number
}

export interface AutoDetectedItem extends PDFOverlayItem {
    confidence: number
    sourceText: string
    autoDetected: true
}

interface ClassificationResult {
    entityType: PDFOverlayEntityType
    confidence: number
}

// ─── Pattern Definitions ──────────────────────────────────────────────────────

const PATTERNS: {
    entityType: PDFOverlayEntityType
    patterns: RegExp[]
    confidence: number
}[] = [
        // Diameter — highest priority
        {
            entityType: 'Dimension',
            patterns: [
                /[Øø⌀]\s*\d+(\.\d+)?/,                    // Ø10, ø10.5, ⌀25
                /DIA\.?\s*\d+(\.\d+)?/i,                    // DIA 10, DIA. 10
            ],
            confidence: 0.95,
        },
        // Radius
        {
            entityType: 'Dimension',
            patterns: [
                /^R\s*\d+(\.\d+)?/i,                        // R5, R2.5
                /R\s*MAX\s*\d+(\.\d+)?/i,                   // R MAX 3.5
            ],
            confidence: 0.9,
        },
        // Thread
        {
            entityType: 'Thread',
            patterns: [
                /M\d+(\.\d+)?\s*[×x]\s*\d+(\.\d+)?/i,     // M10×1.5, M12x1.25
                /M\d+(\.\d+)?\s*-\s*\d+[HhGg]/,            // M12-6H
                /\b(UNC|UNF|BSP)\b/i,                        // UNC, UNF, BSP
                /\bM\d+(\.\d+)?\b/,                          // M10, M12 (standalone)
            ],
            confidence: 0.9,
        },
        // GD&T symbols
        {
            entityType: 'GD&T',
            patterns: [
                /[⊥∥∠○⌭⌖⌗⌔⌒△◎↗]/,                          // Unicode GD&T symbols
                /\b(GD\s*&?\s*T)\b/i,                        // Text "GD&T"
                /[⏥⏛⏜⟂⌰]/,                                  // More GD&T Unicode variants
                /\|[◎⊕]\|/,                                   // Tolerance frame pattern
            ],
            confidence: 0.85,
        },
        // Tolerance
        {
            entityType: 'Tolerance',
            patterns: [
                /±\s*\d+(\.\d+)?/,                           // ±0.05
                /[+]\s*\d+(\.\d+)?\s*\/\s*[-]\s*\d+(\.\d+)?/, // +0.02/-0.01
                /\b[A-Z]\d+\s*\/\s*[a-z]\d+\b/,             // H7/g6
                /\b\d+[HhGgJjKkMmNnPpRrSsTtUu]\d+\b/,      // 10H7, etc — ISO tolerance
                /\b[Hh][1-9]\d?\b/,                           // H7, H8
                /\b[Gg][1-9]\d?\b/,                           // g6
            ],
            confidence: 0.85,
        },
        // Surface finish
        {
            entityType: 'Surface Finish',
            patterns: [
                /\bRa\s*\d+(\.\d+)?/i,                      // Ra 1.6
                /\bRz\s*\d+(\.\d+)?/i,                      // Rz 6.3
                /[▽]+/,                                       // ▽, ▽▽, ▽▽▽
                /\bN[4-9]\d?\b/,                              // N6, N7
            ],
            confidence: 0.8,
        },
        // Weld
        {
            entityType: 'Weld',
            patterns: [
                /\bWELD\b/i,                                  // WELD ALL AROUND
                /\bWELDING\b/i,
                /\bFILLET\s*WELD\b/i,
            ],
            confidence: 0.85,
        },
        // Material / Specification
        {
            entityType: 'Material',
            patterns: [
                /\b(SS\s*\d{3}|EN\s*\d+|AISI\s*\d{4})\b/i,  // SS316, EN8, AISI 4140
                /\b(HRC|HB|HRA)\s*\d+/i,                     // HRC 58
                /\bASTM\s*[A-Z]?\s*\d+/i,                    // ASTM A36
                /\bIS\s*\d{3,5}\b/i,                          // IS 2062
            ],
            confidence: 0.8,
        },
        // Notes
        {
            entityType: 'Note',
            patterns: [
                /^NOTE\s*\d*/i,                               // NOTE 1, NOTES:
                /^NOTES\s*:?/i,
                /\bGENERAL\s*TOLERANCE/i,                     // GENERAL TOLERANCE
                /\bUNLESS\s*OTHERWISE/i,                      // UNLESS OTHERWISE
                /\bALL\s*DIMENSIONS\b/i,
            ],
            confidence: 0.7,
        },
        // Dimension — linear (lowest priority, most common)
        {
            entityType: 'Dimension',
            patterns: [
                /^\d+(\.\d+)?\s*(mm|cm|in|m)\s*$/i,          // 10mm, 10.5cm
                /^\d+(\.\d+)?\s*$/,                           // 10, 10.5 (bare number)
                /^\d+\s*\/\s*\d+\s*"/,                        // 3/4"
                /^\d+(\.\d+)?\s*±\s*\d+(\.\d+)?/,            // 25.4 ±0.1
                /^\d{1,4}\.\d{1,4}\b/,                        // 1.750
            ],
            confidence: 0.6,
        },
    ]

// ─── Text Extraction ──────────────────────────────────────────────────────────

async function extractRawText(pdfUrl: string): Promise<RawTextItem[]> {
    const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
    })

    const doc = await loadingTask.promise
    const items: RawTextItem[] = []

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum)
        const textContent = await page.getTextContent()
        const viewport = page.getViewport({ scale: 1 })

        for (const item of textContent.items) {
            // pdfjs types are loose, cast as needed
            const textItem = item as {
                str: string
                transform: number[]
                width: number
                height: number
            }

            if (!textItem.str || !textItem.str.trim()) continue

            const tx = textItem.transform[4]
            const ty = textItem.transform[5]

            // Normalize: PDF coords have (0,0) at bottom-left.
            // Convert to top-left (0,0)→(1,1)
            const x = tx / viewport.width
            const y = (viewport.height - ty) / viewport.height
            const w = (textItem.width || 0) / viewport.width
            const h = (textItem.height || 0) / viewport.height

            items.push({
                text: textItem.str,
                x, y, width: w, height: h,
                page: pageNum,
                rawX: tx, rawY: ty,
                rawW: textItem.width || 0,
                rawH: textItem.height || 0,
            })
        }
    }

    return items
}

// ─── Text Merging ─────────────────────────────────────────────────────────────

/**
 * PDF.js often splits text into fragments. Merge items whose bounding boxes
 * overlap or are within 3px horizontally on the same Y line.
 * This reconstructs e.g. "Ø 10.5 ±0.2" from 3 fragments.
 */
function mergeTextItems(items: RawTextItem[]): RawTextItem[] {
    if (items.length === 0) return []

    // Group by page
    const byPage = new Map<number, RawTextItem[]>()
    for (const item of items) {
        const group = byPage.get(item.page) || []
        group.push(item)
        byPage.set(item.page, group)
    }

    const merged: RawTextItem[] = []

    for (const [, pageItems] of byPage) {
        // Sort by rawY descending (bottom-up in PDF coords), then rawX ascending
        const sorted = [...pageItems].sort((a, b) => {
            const yDiff = Math.abs(a.rawY - b.rawY)
            if (yDiff > 3) return b.rawY - a.rawY  // different lines
            return a.rawX - b.rawX                    // same line, left to right
        })

        const used = new Set<number>()

        for (let i = 0; i < sorted.length; i++) {
            if (used.has(i)) continue

            let current = { ...sorted[i] }
            used.add(i)

            // Try to merge subsequent items on same Y line
            for (let j = i + 1; j < sorted.length; j++) {
                if (used.has(j)) continue

                const next = sorted[j]
                const yDiff = Math.abs(current.rawY - next.rawY)
                const gap = next.rawX - (current.rawX + current.rawW)

                // Same line (Y within 3px) and gap < 3px
                if (yDiff <= 3 && gap >= -2 && gap <= 3) {
                    // Merge
                    const newRawW = (next.rawX + next.rawW) - current.rawX
                    current = {
                        ...current,
                        text: current.text + next.text,
                        rawW: newRawW,
                        width: newRawW / (current.width > 0 ? current.width / current.x : 1), // rough recalc
                    }
                    // Recalculate normalized width
                    if (current.x > 0 && current.width > 0) {
                        // Use first item's viewport ratio
                        const vpWidth = current.rawX / current.x
                        current.width = newRawW / vpWidth
                    }
                    used.add(j)
                }
            }

            merged.push(current)
        }
    }

    return merged
}

// ─── Classification ───────────────────────────────────────────────────────────

function classify(text: string): ClassificationResult | null {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 100) return null  // Skip long text blocks (titles, notes paragraphs)

    for (const category of PATTERNS) {
        for (const pattern of category.patterns) {
            if (pattern.test(trimmed)) {
                return {
                    entityType: category.entityType,
                    confidence: category.confidence,
                }
            }
        }
    }

    return null
}

// ─── Proximity Deduplication ──────────────────────────────────────────────────

/**
 * After detection, if two detected items are within 15px of each other
 * AND same type, keep only the one with higher confidence.
 */
function deduplicateByProximity(items: AutoDetectedItem[], viewportWidth: number, viewportHeight: number): AutoDetectedItem[] {
    // 15px proximity threshold — convert to normalized coordinates
    const thresholdX = viewportWidth > 0 ? 15 / viewportWidth : 0.02
    const thresholdY = viewportHeight > 0 ? 15 / viewportHeight : 0.02

    const result: AutoDetectedItem[] = []
    const removed = new Set<number>()

    for (let i = 0; i < items.length; i++) {
        if (removed.has(i)) continue

        let best = items[i]

        for (let j = i + 1; j < items.length; j++) {
            if (removed.has(j)) continue

            const other = items[j]
            const dx = Math.abs((best.x ?? 0) - (other.x ?? 0))
            const dy = Math.abs((best.y ?? 0) - (other.y ?? 0))

            if (dx <= thresholdX && dy <= thresholdY && best.entityType === other.entityType) {
                // Keep the one with higher confidence
                if (other.confidence > best.confidence) {
                    removed.add(i)
                    best = other
                } else {
                    removed.add(j)
                }
            }
        }

        if (!removed.has(i)) {
            result.push(best)
        }
    }

    return result
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run auto-balloon detection on a PDF.
 *
 * @param pdfUrl URL of the PDF to analyze
 * @param existingCount Number of existing balloons (offset for new numbers)
 * @returns Array of auto-detected items ready for placement
 */
export async function runAutoBalloon(
    pdfUrl: string,
    existingCount: number
): Promise<AutoDetectedItem[]> {
    // Step 1: Extract raw text
    const rawItems = await extractRawText(pdfUrl)

    if (rawItems.length === 0) {
        // Scanned PDF — no text content
        throw new ScannedPDFError()
    }

    // Step 2: Merge fragmented text
    const mergedItems = mergeTextItems(rawItems)

    // Step 3: Classify each merged item
    const detected: AutoDetectedItem[] = []

    for (const item of mergedItems) {
        const classification = classify(item.text)
        if (!classification) continue

        const centerX = item.x + (item.width / 2)
        const centerY = item.y

        detected.push({
            id: '', // Will be assigned by caller
            type: 'callout',
            points: [{ x: centerX, y: centerY }],
            x: centerX,
            y: centerY,
            page: item.page,
            text: item.text.trim(),
            color: '#3b82f6',
            entityType: classification.entityType,
            drawingReference: item.text.trim(),
            description: `Auto-detected ${classification.entityType}`,
            confidence: classification.confidence,
            sourceText: item.text,
            autoDetected: true,
            leaderOffset: { x: 0.04, y: -0.04 },
        })
    }

    // Step 4: Deduplicate by proximity
    // Use approximate viewport dimensions for threshold calculation
    const deduped = deduplicateByProximity(detected, 800, 600)

    // Step 5: Assign sequential balloon numbers starting after existing
    let balloonNo = existingCount + 1
    for (const item of deduped) {
        item.balloonNo = balloonNo++
    }

    return deduped
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class ScannedPDFError extends Error {
    constructor() {
        super('This appears to be a scanned drawing. Auto-balloon requires vector PDF. Use manual placement.')
        this.name = 'ScannedPDFError'
    }
}
