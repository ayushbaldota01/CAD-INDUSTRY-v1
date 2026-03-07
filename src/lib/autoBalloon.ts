/**
 * Auto-Balloon Engine v2
 *
 * Robust PDF text extraction with multiple fallback strategies:
 * 1. Standard pdfjs-dist text extraction with improved CMap handling
 * 2. Operator-level text extraction for PDFs with embedded/non-standard fonts
 * 3. Annotation-based extraction for PDFs with form fields or annotation text
 * 4. Relaxed "scanned" detection — checks for vector content before giving up
 *
 * Then: merge fragmented items, classify against engineering patterns,
 * deduplicate by proximity, and return positioned overlay items.
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
                /[Øø⌀∅][\s.]*\d+(\.\d+)?/,                    // Ø10, ø10.5, ⌀25, ∅30
                /DIA\.?\s*\d+(\.\d+)?/i,                        // DIA 10, DIA. 10
                /DIAM(ETER)?\.?\s*\d+(\.\d+)?/i,               // DIAMETER 10
                /\bD\s*=\s*\d+(\.\d+)?/i,                       // D=10, D = 25.4
            ],
            confidence: 0.95,
        },
        // Radius
        {
            entityType: 'Dimension',
            patterns: [
                /^R\s*\d+(\.\d+)?/i,                            // R5, R2.5
                /R\s*MAX\s*\d+(\.\d+)?/i,                       // R MAX 3.5
                /RAD(IUS)?\.?\s*\d+(\.\d+)?/i,                 // RADIUS 5
                /\bR\d+(\.\d+)?\b/,                              // R5 inline
            ],
            confidence: 0.9,
        },
        // Thread
        {
            entityType: 'Thread',
            patterns: [
                /M\d+(\.\d+)?\s*[×xX]\s*\d+(\.\d+)?/i,        // M10×1.5, M12x1.25
                /M\d+(\.\d+)?\s*-\s*\d+[HhGg]/,                // M12-6H
                /\b(UNC|UNF|BSP|NPT|BSPT|BSPP)\b/i,            // UNC, UNF, BSP, NPT...
                /\bM\d+(\.\d+)?\b/,                              // M10, M12 (standalone)
                /\d+[/-]\d+\s*(UNC|UNF|TPI)/i,                  // 1/4-20 UNC
                /\bTAP\b.*\bM?\d+/i,                             // TAP M10, TAP 1/4
                /\bTHREAD\b/i,                                    // THREAD callout
                /\bTHD\b/i,                                       // THD abbreviation
            ],
            confidence: 0.9,
        },
        // GD&T symbols
        {
            entityType: 'GD&T',
            patterns: [
                /[⊥∥∠○⌭⌖⌗⌔⌒△◎↗⊙⊕⊘]/,                        // Unicode GD&T symbols
                /\b(GD\s*&?\s*T)\b/i,                            // Text "GD&T"
                /[⏥⏛⏜⟂⌰]/,                                      // More GD&T Unicode variants
                /\|[◎⊕]\|/,                                       // Tolerance frame pattern
                /\bDATUM\s*[A-Z]\b/i,                             // DATUM A, DATUM B
                /\b(FLATNESS|STRAIGHTNESS|CIRCULARITY|CYLINDRICITY)\b/i,
                /\b(PARALLELISM|PERPENDICULARITY|ANGULARITY)\b/i,
                /\b(POSITION|CONCENTRICITY|SYMMETRY|RUNOUT)\b/i,
                /\b(TRUE\s*POSITION|TP)\b/i,                      // True Position
                /\b(MMC|LMC|RFS)\b/,                              // Material condition
                /[ⓂⓁⓈ]/,                                          // Circled M, L, S
            ],
            confidence: 0.85,
        },
        // Tolerance
        {
            entityType: 'Tolerance',
            patterns: [
                /±\s*\d+(\.\d+)?/,                               // ±0.05
                /[+]\s*\d+(\.\d+)?\s*\/\s*[-]\s*\d+(\.\d+)?/,   // +0.02/-0.01
                /\b[A-Z]\d+\s*\/\s*[a-z]\d+\b/,                 // H7/g6
                /\b\d+[HhGgJjKkMmNnPpRrSsTtUu]\d+\b/,          // 10H7, etc — ISO tolerance
                /\b[Hh][1-9]\d?\b/,                               // H7, H8
                /\b[Gg][1-9]\d?\b/,                               // g6
                /\bTOL(ERANCE)?\.?\s*[\d.±]/i,                   // TOL 0.05, TOLERANCE ±
                /\+\d+(\.\d+)?\s*[-]\s*\d+(\.\d+)?/,            // +0.1 -0.05
                /\b0\.\d{2,}/,                                     // 0.025, 0.001 (precision decimals)
            ],
            confidence: 0.85,
        },
        // Surface finish
        {
            entityType: 'Surface Finish',
            patterns: [
                /\bRa\s*\d+(\.\d+)?/i,                          // Ra 1.6
                /\bRz\s*\d+(\.\d+)?/i,                          // Rz 6.3
                /\bRt\s*\d+(\.\d+)?/i,                          // Rt 10
                /\bRq\s*\d+(\.\d+)?/i,                          // Rq 1.25
                /[▽]+/,                                           // ▽, ▽▽, ▽▽▽
                /\bN[4-9]\d?\b/,                                  // N6, N7
                /\bSURFACE\s*FINISH\b/i,                          // SURFACE FINISH callout
                /\b(GRIND|POLISH|HONE|LAP)\b/i,                  // Finish process
                /√/,                                               // Root symbol for surface finish
                /\bCLA\s*\d+/i,                                   // CLA (center line average)
                /\bRMS\s*\d+/i,                                   // RMS surface finish 
            ],
            confidence: 0.8,
        },
        // Weld
        {
            entityType: 'Weld',
            patterns: [
                /\bWELD\b/i,                                      // WELD ALL AROUND
                /\bWELDING\b/i,
                /\bFILLET\s*WELD\b/i,
                /\bBUTT\s*WELD\b/i,
                /\bSPOT\s*WELD\b/i,
                /\bSEAM\s*WELD\b/i,
                /\bTIG\b|\bMIG\b|\bSMAW\b/i,                     // Weld process
            ],
            confidence: 0.85,
        },
        // Material / Specification
        {
            entityType: 'Material',
            patterns: [
                /\b(SS\s*\d{3}|EN\s*\d+|AISI\s*\d{3,4})\b/i,   // SS316, EN8, AISI 4140
                /\b(HRC|HB|HRA)\s*\d+/i,                         // HRC 58
                /\bASTM\s*[A-Z]?\s*\d+/i,                        // ASTM A36
                /\bIS\s*\d{3,5}\b/i,                              // IS 2062
                /\bSAE\s*\d{3,4}/i,                               // SAE 1045
                /\bDIN\s*\d{3,5}/i,                               // DIN 17100
                /\bJIS\s*[A-Z]?\s*\d+/i,                         // JIS G4051
                /\bAL(UMINUM|UMINIUM)?\s*\d{4}/i,                // AL 6061, ALUMINUM 7075
                /\bSTAINLESS\s*STEEL\b/i,                         // STAINLESS STEEL
                /\bMILD\s*STEEL\b/i,                               // MILD STEEL
                /\bCARBON\s*STEEL\b/i,                             // CARBON STEEL
                /\bBRASS\b|\bBRONZE\b|\bCOPPER\b/i,              // Common metals
                /\bTITANIUM\b|\bINCONEL\b|\bMONEL\b/i,           // Exotic metals
                /\bNYLON\b|\bPTFE\b|\bDELRIN\b|\bPOM\b/i,        // Plastics
                /\bHARDEN\b|\bHEAT\s*TREAT/i,                     // Heat treatment
                /\bTEMPER\b|\bANNEAL\b|\bQUENCH\b/i,             // Heat treatment processes
                /\bPLATE\b|\bSHEET\b|\bBAR\b|\bROD\b/i,          // Stock forms
            ],
            confidence: 0.8,
        },
        // Notes
        {
            entityType: 'Note',
            patterns: [
                /^NOTE\s*\d*/i,                                   // NOTE 1, NOTES:
                /^NOTES\s*:?/i,
                /\bGENERAL\s*TOLERANCE/i,                         // GENERAL TOLERANCE
                /\bUNLESS\s*OTHERWISE/i,                          // UNLESS OTHERWISE
                /\bALL\s*DIMENSIONS\b/i,
                /\bBREAK\s*(ALL\s*)?SHARP\s*EDGE/i,              // BREAK SHARP EDGES
                /\bDEBURR\b/i,                                     // DEBURR
                /\bCHAMFER\b/i,                                    // CHAMFER callout
                /\bDO\s*NOT\s*SCALE/i,                             // DO NOT SCALE
                /\bTHIRD\s*ANGLE/i,                                // THIRD ANGLE PROJECTION
                /\bFIRST\s*ANGLE/i,                                // FIRST ANGLE PROJECTION
                /\bSCALE\s*[:\d]/i,                                // SCALE 1:1, SCALE 2:1
                /\bDRAWN\s*(BY)?/i,                                // DRAWN BY
                /\bCHECKED\s*(BY)?/i,                              // CHECKED BY
                /\bAPPROVED\s*(BY)?/i,                             // APPROVED BY
                /\bDATE\s*:/i,                                     // DATE:
                /\bREV(ISION)?\s*[.:]/i,                           // REV A, REVISION:
                /\bPART\s*(NO|NUMBER|#)/i,                         // PART NO, PART NUMBER
                /\bDWG\s*(NO|NUMBER|#)/i,                          // DWG NO
                /\bDRAWING\s*(NO|NUMBER|#)/i,                      // DRAWING NO
                /\bSHEET\s*\d+\s*OF\s*\d+/i,                      // SHEET 1 OF 3
                /\bMAT(ERIA)?L\s*:/i,                              // MATERIAL:
                /\bFINISH\s*:/i,                                   // FINISH:
                /\bQTY\s*[:\d]/i,                                  // QTY: 2
                /\bQUANTITY\s*[:\d]/i,                             // QUANTITY: 2
            ],
            confidence: 0.7,
        },
        // Dimension — linear (lowest priority, most common)
        {
            entityType: 'Dimension',
            patterns: [
                /^\d+(\.\d+)?\s*(mm|cm|in|m|inches|inch)\s*$/i,  // 10mm, 10.5cm
                /^\d+(\.\d+)?\s*$/,                               // 10, 10.5 (bare number)
                /^\d+\s*\/\s*\d+\s*"/,                             // 3/4"
                /^\d+(\.\d+)?\s*±\s*\d+(\.\d+)?/,                // 25.4 ±0.1
                /^\d{1,4}\.\d{1,4}\b/,                            // 1.750
                /\d+°\s*\d+['′]\s*\d+["″]?/,                      // 45°30'15" angle
                /\d+(\.\d+)?°/,                                    // 45° or 90.5°
                /\bTYP\b/i,                                        // TYP (typical dimension)
                /\bREF\b/i,                                        // REF (reference dimension)
                /×\s*\d+(\.\d+)?/,                                 // ×25.4 (multiplication in dim)
                /\d+(\.\d+)?\s*[xX]\s*\d+(\.\d+)?/,              // 10x20, 10.5 X 20
                /\bC\/?(BORE|SINK)\b/i,                            // CBORE, C'BORE, CSINK
                /\bCOUNTER\s*(BORE|SINK)\b/i,                      // COUNTERBORE, COUNTERSINK
                /\bDEPTH\s*\d+(\.\d+)?/i,                         // DEPTH 10
                /\bDP\s*\d+(\.\d+)?/i,                             // DP 10 (depth)
                /\bTHRU\b/i,                                        // THRU (thru hole)
                /\bSLOT\b/i,                                        // SLOT callout
                /\bCHAM\s*\d+/i,                                   // CHAM 0.5×45°
                /\d+\s*HOLES?/i,                                   // 4 HOLES, 2 HOLE
                /\d+\s*PLACES?/i,                                  // 4 PLACES, 2 PLACE
                /\bEQ(UALLY)?\s*SP(ACED|C)?\b/i,                  // EQUALLY SPACED, EQ SPC
                /\bPCD\s*\d+/i,                                    // PCD 100 (pitch circle diameter)
                /\bB\.?C\.?\s*\d+/i,                               // BC 100, B.C. 75 (bolt circle)
            ],
            confidence: 0.6,
        },
    ]

// ─── Text Extraction — Primary Strategy ───────────────────────────────────────

async function extractRawText(pdfUrl: string): Promise<{ items: RawTextItem[]; hasVectorContent: boolean }> {
    const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
        // Force standard font data loading for better text extraction
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    })

    const doc = await loadingTask.promise
    const items: RawTextItem[] = []
    let hasVectorContent = false

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1 })

        // ─── Strategy 1: Standard text content extraction ─────────────────
        try {
            const textContent = await page.getTextContent({
                // These options help with CAD-generated PDFs
                includeMarkedContent: false,
            } as any)

            for (const item of textContent.items) {
                const textItem = item as {
                    str: string
                    transform: number[]
                    width: number
                    height: number
                    fontName?: string
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
        } catch {
            // Text content extraction failed — continue with other strategies
            console.warn(`[AutoBalloon] Standard text extraction failed for page ${pageNum}`)
        }

        // ─── Strategy 2: Operator-level extraction ────────────────────────
        // If standard extraction yielded nothing for this page, try reading
        // the raw page operators (Tj, TJ, ', ") which sometimes work when
        // getTextContent() doesn't (e.g., CIDFontType2 embedded fonts).
        if (items.filter(i => i.page === pageNum).length === 0) {
            try {
                const opList = await page.getOperatorList()
                const ops = opList.fnArray
                const args = opList.argsArray

                // OPS we care about — these indicate vector content
                const drawingOps = [
                    pdfjsLib.OPS.moveTo,
                    pdfjsLib.OPS.lineTo,
                    pdfjsLib.OPS.curveTo,
                    pdfjsLib.OPS.rectangle,
                    pdfjsLib.OPS.stroke,
                    pdfjsLib.OPS.fill,
                    pdfjsLib.OPS.eoFill,
                ]

                let vectorOpCount = 0
                for (let i = 0; i < ops.length; i++) {
                    if (drawingOps.includes(ops[i])) {
                        vectorOpCount++
                    }
                }

                // If there are significant drawing operations, this is a vector PDF
                // (not a scanned image — a scanned PDF would mostly have paintImageXObject ops)
                if (vectorOpCount > 20) {
                    hasVectorContent = true
                }

                // Check for paintImageXObject ops — a PDF that is almost entirely
                // image renders is likely scanned
                let imageOpCount = 0
                for (let i = 0; i < ops.length; i++) {
                    if (ops[i] === pdfjsLib.OPS.paintImageXObject ||
                        ops[i] === (pdfjsLib.OPS as any).paintJpegXObject || ops[i] === pdfjsLib.OPS.paintXObject) {
                        imageOpCount++
                    }
                }

                // Try to extract text from showText / showSpacedText ops
                const textOps = [
                    pdfjsLib.OPS.showText,      // Tj
                    pdfjsLib.OPS.showSpacedText, // TJ
                ]

                for (let i = 0; i < ops.length; i++) {
                    if (textOps.includes(ops[i]) && args[i]) {
                        let text = ''
                        const arg = args[i]

                        if (Array.isArray(arg)) {
                            for (const part of arg) {
                                if (Array.isArray(part)) {
                                    // TJ array: mix of strings and spacing
                                    for (const subPart of part) {
                                        if (typeof subPart === 'string') {
                                            text += subPart
                                        }
                                    }
                                } else if (typeof part === 'string') {
                                    text += part
                                }
                            }
                        }

                        if (text.trim()) {
                            // We don't have precise position from operator level,
                            // distribute items evenly on the page
                            const pageItemCount = items.filter(it => it.page === pageNum).length
                            const row = Math.floor(pageItemCount / 5)
                            const col = pageItemCount % 5

                            items.push({
                                text: text.trim(),
                                x: 0.1 + col * 0.16,
                                y: 0.1 + row * 0.08,
                                width: 0.1,
                                height: 0.02,
                                page: pageNum,
                                rawX: (0.1 + col * 0.16) * viewport.width,
                                rawY: (0.9 - row * 0.08) * viewport.height,
                                rawW: 0.1 * viewport.width,
                                rawH: 0.02 * viewport.height,
                            })
                        }
                    }
                }

                // Even if no text found via operators, if vector content exists, mark it
                if (vectorOpCount > 20 && imageOpCount < 3) {
                    hasVectorContent = true
                }
            } catch {
                console.warn(`[AutoBalloon] Operator-level extraction failed for page ${pageNum}`)
            }
        } else {
            // We got text items from standard extraction, this is definitely vector
            hasVectorContent = true
        }

        // ─── Strategy 3: Check page annotations ──────────────────────────
        // Some CAD exports store dimension text as PDF annotations
        try {
            const annots = await page.getAnnotations()
            for (const annot of annots) {
                if (!annot.contents && !annot.fieldValue) continue
                const annotText = (annot.contents || annot.fieldValue || '').trim()
                if (!annotText) continue

                // Check if we already have this text from standard extraction
                const alreadyHave = items.some(
                    i => i.page === pageNum && i.text === annotText
                )
                if (alreadyHave) continue

                // Use annotation rect for positioning
                const rect = annot.rect || [0, 0, 0, 0]
                const x = rect[0] / viewport.width
                const y = (viewport.height - rect[3]) / viewport.height
                const w = (rect[2] - rect[0]) / viewport.width
                const h = (rect[3] - rect[1]) / viewport.height

                items.push({
                    text: annotText,
                    x, y, width: Math.abs(w), height: Math.abs(h),
                    page: pageNum,
                    rawX: rect[0], rawY: rect[1],
                    rawW: rect[2] - rect[0],
                    rawH: rect[3] - rect[1],
                })

                hasVectorContent = true
            }
        } catch {
            // Annotation extraction is optional
        }
    }

    return { items, hasVectorContent }
}

// ─── Text Merging ─────────────────────────────────────────────────────────────

/**
 * PDF.js often splits text into fragments. Merge items whose bounding boxes
 * overlap or are within a few pixels horizontally on the same Y line.
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

                // Increase Y tolerance to 5px, gap to 12px for real engineering PDFs
                // CAD exports often have slightly misaligned text baselines
                if (yDiff <= 5 && gap >= -2 && gap <= 12) {
                    const newRawW = (next.rawX + next.rawW) - current.rawX
                    // Correct normalized width: vpWidth = rawX / x (only valid when x > 0)
                    const vpWidth = current.x > 0 ? current.rawX / current.x : 1
                    current = {
                        ...current,
                        text: current.text + (gap > 1 ? ' ' : '') + next.text,
                        rawW: newRawW,
                        width: newRawW / vpWidth,
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
    if (!trimmed) return null

    // Skip very long text blocks (paragraphs, legal text) but allow up to 200 chars
    // for engineering notes which can be longer
    if (trimmed.length > 200) return null

    // Skip single characters that aren't engineering symbols
    if (trimmed.length === 1 && !/[Øø⌀∅⊥∥∠○△±×√▽RMCDdABNPQSTUVWXYZ0-9]/.test(trimmed)) {
        return null
    }

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

// ─── Deduplicate by Exact Text ────────────────────────────────────────────────

/**
 * Remove items with identical text + same entity type if they are on the same page
 * (keeps the first occurrence). This prevents duplicate balloons for merged text.
 */
function deduplicateByText(items: AutoDetectedItem[]): AutoDetectedItem[] {
    const seen = new Set<string>()
    return items.filter(item => {
        const key = `${item.page}:${item.entityType}:${item.text?.trim()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
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
    console.log('[AutoBalloon] Starting analysis...')

    // Step 1: Extract raw text using multiple strategies
    const { items: rawItems, hasVectorContent } = await extractRawText(pdfUrl)

    console.log(`[AutoBalloon] Extracted ${rawItems.length} text items, hasVectorContent=${hasVectorContent}`)

    if (rawItems.length === 0 && !hasVectorContent) {
        // Truly a scanned PDF — no text content AND no vector drawing operations
        throw new ScannedPDFError()
    }

    // If we have vector content but no text, this is a vector PDF with
    // text encoded as paths — we can't auto-detect but shouldn't call it "scanned"
    if (rawItems.length === 0 && hasVectorContent) {
        throw new VectorNoTextError()
    }

    // Step 2: Merge fragmented text
    const mergedItems = mergeTextItems(rawItems)
    console.log(`[AutoBalloon] After merging: ${mergedItems.length} items`)

    // Log first 20 merged items for debugging
    for (const item of mergedItems.slice(0, 20)) {
        console.log(`  [text] "${item.text}" at (${item.x.toFixed(3)}, ${item.y.toFixed(3)})`)
    }

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

    console.log(`[AutoBalloon] Classified ${detected.length} items`)

    // Step 4: Deduplicate by exact text first
    const textDeduped = deduplicateByText(detected)

    // Step 5: Deduplicate by proximity
    // Use larger viewport dims for A3/A4 engineering drawings at scale 1
    const deduped = deduplicateByProximity(textDeduped, 1200, 900)

    console.log(`[AutoBalloon] After deduplication: ${deduped.length} items`)

    // Step 6: Assign sequential balloon numbers starting after existing
    let balloonNo = existingCount + 1
    for (const item of deduped) {
        item.balloonNo = balloonNo++
    }

    return deduped
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class ScannedPDFError extends Error {
    constructor() {
        super('This appears to be a scanned drawing (raster image). Auto-balloon requires a vector PDF with extractable text. Use manual placement instead.')
        this.name = 'ScannedPDFError'
    }
}

export class VectorNoTextError extends Error {
    constructor() {
        super('This PDF contains vector graphics but text is embedded as paths/curves and cannot be extracted programmatically. The drawing may use outlined fonts or CAD-specific text encoding. Use manual balloon placement.')
        this.name = 'VectorNoTextError'
    }
}
