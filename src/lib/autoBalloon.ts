import * as pdfjsLib from 'pdfjs-dist';
// import { pdfjs } from 'react-pdf'; // Using pdfjs-dist directly as in PdfAnnotator.tsx

// Configure worker locally if needed, but PdfAnnotator sets it globally?
// Let's assume it's set or we need to set it here too if this runs independently.
// For now, assume it runs in the same context as PdfAnnotator which sets the worker.

export interface ExtractedItem {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
}

export const extractTextFromPDF = async (pdfUrl: string): Promise<ExtractedItem[]> => {
    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const doc = await loadingTask.promise;
        const numPages = doc.numPages;
        const items: ExtractedItem[] = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });

            // Normalize coordinates
            // PDF coordinates: (0,0) is bottom-left usually. 
            // We need normalized (0,0) top-left to (1,1) bottom-right.
            // But verify pdfjs-dist output. It usually gives transform matrix.

            textContent.items.forEach((item: any) => {
                if (!item.str || !item.str.trim()) return;

                // Transform matrix: [scaleX, skewY, skewX, scaleY, tx, ty]
                // ty is from bottom-left. 
                // We need to convert to top-left normalized.
                const tx = item.transform[4];
                const ty = item.transform[5];

                // Normalization
                // x = tx / viewport.width
                // y = (viewport.height - ty) / viewport.height  <-- Flip Y

                const x = tx / viewport.width;
                const y = (viewport.height - ty) / viewport.height;

                items.push({
                    text: item.str,
                    x,
                    y,
                    width: item.width / viewport.width,
                    height: item.height / viewport.height,
                    page: i
                });
            });
        }
        return items;
    } catch (error) {
        console.error("Error extracting text:", error);
        return [];
    }
};

// Simple regex patterns for engineering drawings
const PATTERNS = {
    DIMENSION: /^\d+(\.\d+)?\s*(mm|in|cm|m)?$/, // 10.5, 10mm
    TOLERANCE: /±\s*\d+(\.\d+)?/, // ±0.1
    DIAMETER: /^[Øø]\s*\d+(\.\d+)?/, // Ø10
    RADIUS: /^[Rr]\s*\d+(\.\d+)?/, // R5
    NOTE: /^(NOTE|SECTION|DETAIL)\s+/i, // NOTE 1
    GD_T: /^[⊥∥∠⌒]\s*\d+/, // Geometric symbols (basic check)
};

export const analyzeTextItems = (items: ExtractedItem[]) => {
    return items.map(item => {
        const text = item.text.trim();
        let type: 'Dimension' | 'Tolerance' | 'Note' | 'Specification' | null = null;

        if (PATTERNS.DIMENSION.test(text) || PATTERNS.DIAMETER.test(text) || PATTERNS.RADIUS.test(text)) {
            type = 'Dimension';
        } else if (PATTERNS.TOLERANCE.test(text)) {
            type = 'Tolerance';
        } else if (PATTERNS.NOTE.test(text)) {
            type = 'Note';
        } else if (PATTERNS.GD_T.test(text)) {
            type = 'Specification';
        }

        return type ? { ...item, type } : null;
    }).filter(Boolean) as (ExtractedItem & { type: string })[];
};
