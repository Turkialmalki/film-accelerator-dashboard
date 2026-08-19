'use client';

import { toCsv } from '@/lib/csv';
import type { ExportSection } from './types';

/**
 * xlsx, jsPDF and html2canvas together are several hundred KB — real weight
 * on a page every admin visits, for a feature most visits never use.
 * Dynamically imported inside each function below rather than at module
 * top level, so none of it enters the dashboard route's initial bundle; it
 * loads only once someone actually presses download.
 */

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * One CSV per export, all selected sections concatenated — CSV has no
 * concept of multiple sheets, so each table becomes a titled block separated
 * by a blank row rather than a separate file (which would mean either a zip
 * dependency or N browser downloads firing at once).
 */
export function exportSectionsAsCsv(sections: ExportSection[], baseName: string): void {
  const rows: (string | number)[][] = [];
  sections.forEach((section) => {
    section.tables.forEach((table) => {
      rows.push([table.title]);
      rows.push(table.headers);
      rows.push(...table.rows);
      rows.push([]);
    });
  });
  const csv = `﻿${toCsv(rows)}`;
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `${baseName}-${timestamp()}.csv`,
  );
}

/** One workbook, one sheet per table. Sheet names are capped at Excel's
 * 31-character limit and stripped of the characters Excel rejects. */
export async function exportSectionsAsExcel(
  sections: ExportSection[],
  baseName: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  sections.forEach((section) => {
    section.tables.forEach((table) => {
      let name = table.title.replace(/[[\]*/\\?:]/g, ' ').trim().slice(0, 31) || 'Sheet';
      let n = 2;
      while (used.has(name)) {
        const suffix = ` (${n})`;
        name = `${name.slice(0, 31 - suffix.length)}${suffix}`;
        n += 1;
      }
      used.add(name);

      const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
      XLSX.utils.book_append_sheet(wb, sheet, name);
    });
  });

  XLSX.writeFile(wb, `${baseName}-${timestamp()}.xlsx`);
}

/**
 * Renders `node` (an off-screen, already-laid-out DOM subtree — see
 * `PrintLayout`) with html2canvas and slices the result across A4 pages.
 *
 * Why not build the PDF from text directly with jsPDF: jsPDF's text() draws
 * each character as an isolated glyph — it does not apply Arabic letter
 * joining (initial/medial/final forms) or bidi reordering, so Arabic content
 * renders as disconnected, wrong-order characters. Rasterizing real,
 * browser-shaped DOM output sidesteps that entirely: whatever the page
 * itself renders correctly, the PDF gets pixel-for-pixel.
 */
export async function exportNodeAsPdf(node: HTMLElement, baseName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // scale: 1.5, not the html2canvas default of the device pixel ratio (often
  // 2-3 on modern screens) — this is a dense multi-page table report, not a
  // photo, and a needlessly high-res raster of it was producing 40+MB PDFs.
  // JPEG below does the rest: lossy compression barely shows on flat white
  // table cells but cuts file size by an order of magnitude versus PNG.
  const canvas = await html2canvas(node, {
    scale: 1.5,
    backgroundColor: '#FFFFFF',
    useCORS: true,
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const pxPerPdfPt = canvas.width / imgWidth;
  const pageHeightPx = pageHeight * pxPerPdfPt;

  let renderedPx = 0;
  let pageIndex = 0;

  // A remainder under this is treated as trailing whitespace, not content,
  // and gets folded into the previous page rather than becoming its own
  // near-blank one. `PrintLayout`'s own last-section margin plus the
  // container's bottom padding reliably leaves ~60-90px of nothing after
  // the real content ends; a naive "> 0" loop turned that into a whole
  // extra PDF page with visibly nothing on it, every export.
  const MIN_MEANINGFUL_SLICE_PX = 120;
  while (canvas.height - renderedPx > MIN_MEANINGFUL_SLICE_PX) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        canvas,
        0,
        renderedPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx,
      );
    }

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL('image/jpeg', 0.88),
      'JPEG',
      0,
      0,
      imgWidth,
      sliceHeightPx / pxPerPdfPt,
    );

    renderedPx += sliceHeightPx;
    pageIndex += 1;
  }

  pdf.save(`${baseName}-${timestamp()}.pdf`);
}
