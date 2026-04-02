import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";

import type { NextSessionPrescriptionItem, WorkoutAnalysisResult } from "@/lib/types/analysis";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42;
const FOOTER_BOTTOM = 22;
const CONTENT_BOTTOM_RESERVE = FOOTER_BOTTOM + 14;

const TABLE_FONT = 9.5;
const HEADER_FONT = 10;
const RATIONALE_FONT = 7.8;
const PLACEHOLDER_FONT = 7.5;
const PLACEHOLDER_LABEL = "eintragen";
const TITLE = 18;
const SUB = 10;
const HEADER_ROW_H = 30;
const MIN_ROW_H = 56;
const LINE_H = 11.8;
const LINE_H_SMALL = 9.2;
const NAME_MAX_LINES = 2;
const RATIONALE_MAX_LINES = 3;
const TARGET_MAX_LINES = 5;

const COLS = {
  exercise: 121,
  target: 121,
  s1: 37,
  s2: 37,
  s3: 37,
  s4: 37,
  notes: 121,
} as const;

const C = {
  pageBg: rgb(0.992, 0.989, 0.984),
  accent: rgb(0.12, 0.55, 0.75),
  title: rgb(0.11, 0.13, 0.16),
  muted: rgb(0.42, 0.44, 0.48),
  rationaleMuted: rgb(0.38, 0.4, 0.44),
  headerBg: rgb(0.78, 0.82, 0.86),
  headerBorder: rgb(0.55, 0.6, 0.65),
  rowA: rgb(0.98, 0.96, 0.92),
  rowB: rgb(0.96, 0.97, 0.99),
  rowBorder: rgb(0.82, 0.84, 0.88),
  grid: rgb(0.88, 0.89, 0.92),
  placeholder: rgb(0.72, 0.74, 0.78),
  boxBg: rgb(0.93, 0.94, 0.96),
  boxBorder: rgb(0.7, 0.72, 0.76),
  footer: rgb(0.45, 0.47, 0.5),
};

function colXs(): number[] {
  const x0 = MARGIN;
  return [
    x0,
    x0 + COLS.exercise,
    x0 + COLS.exercise + COLS.target,
    x0 + COLS.exercise + COLS.target + COLS.s1,
    x0 + COLS.exercise + COLS.target + COLS.s1 + COLS.s2,
    x0 + COLS.exercise + COLS.target + COLS.s1 + COLS.s2 + COLS.s3,
    x0 + COLS.exercise + COLS.target + COLS.s1 + COLS.s2 + COLS.s3 + COLS.s4,
  ];
}

function truncateToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxW: number,
): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  let s = t;
  const ell = "…";
  while (s.length > 0) {
    const tryStr = s + ell;
    if (font.widthOfTextAtSize(tryStr, size) <= maxW) return tryStr;
    s = s.slice(0, -1);
  }
  return ell;
}

/** Wortumbruch; lange Einzelwörter werden gekürzt. */
function wrapTextToLines(
  text: string,
  font: PDFFont,
  size: number,
  maxW: number,
  maxLines: number,
): string[] {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let idx = 0;
  while (idx < words.length && lines.length < maxLines) {
    let line = "";
    while (idx < words.length) {
      const trial = line ? `${line} ${words[idx]}` : words[idx];
      if (font.widthOfTextAtSize(trial, size) <= maxW) {
        line = trial;
        idx++;
      } else {
        if (line) break;
        line = truncateToWidth(words[idx], font, size, maxW);
        idx++;
        break;
      }
    }
    if (line) lines.push(line);
  }
  if (idx < words.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    if (!last.endsWith("…")) {
      lines[lines.length - 1] = truncateToWidth(`${last} …`, font, size, maxW);
    }
  }
  return lines.slice(0, maxLines);
}

function progressionBullets(text: string): string[] {
  const raw = text.trim();
  if (!raw) return [];
  const byNl = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byNl.length >= 2) return byNl.slice(0, 5);
  const bySent = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySent.length >= 2) return bySent.slice(0, 5);
  return [raw.length > 220 ? `${raw.slice(0, 217)}…` : raw];
}

function drawVerticalGrid(
  page: PDFPage,
  xs: number[],
  yTopFromPageTop: number,
  rowHeight: number,
  pageH: number,
) {
  const yBottom = pageH - yTopFromPageTop - rowHeight;
  const yTopLine = pageH - yTopFromPageTop;
  for (let i = 1; i < xs.length; i++) {
    page.drawLine({
      start: { x: xs[i], y: yBottom },
      end: { x: xs[i], y: yTopLine },
      thickness: 0.35,
      color: C.grid,
    });
  }
}

function drawPageBackground(page: PDFPage) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4.w,
    height: A4.h,
    color: C.pageBg,
  });
}

function drawTableHeader(
  page: PDFPage,
  yTop: number,
  xs: number[],
  colWidths: number[],
  headers: string[],
  fontBold: PDFFont,
) {
  page.drawRectangle({
    x: MARGIN,
    y: A4.h - yTop - HEADER_ROW_H,
    width: A4.w - 2 * MARGIN,
    height: HEADER_ROW_H,
    color: C.headerBg,
    borderColor: C.headerBorder,
    borderWidth: 0.6,
  });
  drawVerticalGrid(page, xs, yTop, HEADER_ROW_H, A4.h);
  const hb = A4.h - yTop - HEADER_ROW_H * 0.55 + HEADER_FONT * 0.15;
  for (let i = 0; i < headers.length; i++) {
    const t = truncateToWidth(headers[i], fontBold, HEADER_FONT, colWidths[i] - 6);
    page.drawText(t, {
      x: xs[i] + 3,
      y: hb,
      size: HEADER_FONT,
      font: fontBold,
      color: rgb(0.08, 0.09, 0.11),
    });
  }
}

function measurePrescriptionRowHeight(
  row: NextSessionPrescriptionItem,
  fontReg: PDFFont,
): number {
  const maxWEx = COLS.exercise - 6;
  const maxWT = COLS.target - 6;
  const nameLines = wrapTextToLines(row.exercise_name, fontReg, TABLE_FONT, maxWEx, NAME_MAX_LINES);
  const ratRaw = row.rationale?.trim() ?? "";
  const ratLines = ratRaw
    ? wrapTextToLines(ratRaw, fontReg, RATIONALE_FONT, maxWEx, RATIONALE_MAX_LINES)
    : [];
  const ziel = `${row.target_sets}×${row.target_reps} @ ${row.suggested_weight}`;
  const targetLines = wrapTextToLines(ziel, fontReg, TABLE_FONT, maxWT, TARGET_MAX_LINES);

  const nameH = nameLines.length * LINE_H;
  const ratH = ratLines.length > 0 ? ratLines.length * LINE_H_SMALL + 4 : 0;
  const exH = nameH + ratH + 8;
  const targH = targetLines.length * LINE_H + 8;
  return Math.max(MIN_ROW_H, exH, targH);
}

function drawPrescriptionRow(
  page: PDFPage,
  yTop: number,
  row: NextSessionPrescriptionItem,
  rowH: number,
  xs: number[],
  fontReg: PDFFont,
  alt: boolean,
) {
  page.drawRectangle({
    x: MARGIN,
    y: A4.h - yTop - rowH,
    width: A4.w - 2 * MARGIN,
    height: rowH,
    color: alt ? C.rowA : C.rowB,
    borderColor: C.rowBorder,
    borderWidth: 0.35,
  });
  drawVerticalGrid(page, xs, yTop, rowH, A4.h);

  const maxWEx = COLS.exercise - 6;
  const maxWT = COLS.target - 6;
  const nameLines = wrapTextToLines(row.exercise_name, fontReg, TABLE_FONT, maxWEx, NAME_MAX_LINES);
  const ratRaw = row.rationale?.trim() ?? "";
  const ratLines = ratRaw
    ? wrapTextToLines(ratRaw, fontReg, RATIONALE_FONT, maxWEx, RATIONALE_MAX_LINES)
    : [];
  const ziel = `${row.target_sets}×${row.target_reps} @ ${row.suggested_weight}`;
  const targetLines = wrapTextToLines(ziel, fontReg, TABLE_FONT, maxWT, TARGET_MAX_LINES);

  let lineTop = yTop + 4;
  for (const line of nameLines) {
    const t = truncateToWidth(line, fontReg, TABLE_FONT, maxWEx);
    const baseline = A4.h - lineTop - TABLE_FONT * 0.75;
    page.drawText(t, { x: xs[0] + 3, y: baseline, size: TABLE_FONT, font: fontReg, color: rgb(0.08, 0.08, 0.08) });
    lineTop += LINE_H;
  }
  if (ratLines.length > 0) {
    lineTop += 2;
    for (const line of ratLines) {
      const t = truncateToWidth(line, fontReg, RATIONALE_FONT, maxWEx);
      const baseline = A4.h - lineTop - RATIONALE_FONT * 0.75;
      page.drawText(t, {
        x: xs[0] + 3,
        y: baseline,
        size: RATIONALE_FONT,
        font: fontReg,
        color: C.rationaleMuted,
      });
      lineTop += LINE_H_SMALL;
    }
  }

  let tTop = yTop + 4;
  for (const line of targetLines) {
    const t = truncateToWidth(line, fontReg, TABLE_FONT, maxWT);
    const baseline = A4.h - tTop - TABLE_FONT * 0.75;
    page.drawText(t, { x: xs[1] + 3, y: baseline, size: TABLE_FONT, font: fontReg, color: rgb(0.08, 0.08, 0.08) });
    tTop += LINE_H;
  }

  const setXs = [xs[2], xs[3], xs[4], xs[5]];
  const setW = [COLS.s1, COLS.s2, COLS.s3, COLS.s4];
  const centerBaseline =
    A4.h - yTop - rowH / 2 - PLACEHOLDER_FONT * 0.35;
  for (let s = 0; s < 4; s++) {
    page.drawText("—", {
      x: setXs[s] + 3,
      y: centerBaseline,
      size: PLACEHOLDER_FONT,
      font: fontReg,
      color: C.placeholder,
    });
    const lw = fontReg.widthOfTextAtSize(PLACEHOLDER_LABEL, 6.5);
    page.drawText(PLACEHOLDER_LABEL, {
      x: setXs[s] + (setW[s] - lw) / 2,
      y: centerBaseline - PLACEHOLDER_FONT - 1,
      size: 6.5,
      font: fontReg,
      color: C.placeholder,
    });
  }
  const nw = fontReg.widthOfTextAtSize(PLACEHOLDER_LABEL, 6.5);
  page.drawText("—", {
    x: xs[6] + 3,
    y: centerBaseline,
    size: PLACEHOLDER_FONT,
    font: fontReg,
    color: C.placeholder,
  });
  page.drawText(PLACEHOLDER_LABEL, {
    x: xs[6] + (COLS.notes - nw) / 2,
    y: centerBaseline - PLACEHOLDER_FONT - 1,
    size: 6.5,
    font: fontReg,
    color: C.placeholder,
  });
}

function drawPageFooters(pdf: PDFDocument, fontReg: PDFFont, totalPages: number) {
  for (let i = 0; i < totalPages; i++) {
    const p = pdf.getPage(i);
    const label = `Seite ${i + 1} / ${totalPages}`;
    const size = 9;
    const w = fontReg.widthOfTextAtSize(label, size);
    p.drawText(label, {
      x: (A4.w - w) / 2,
      y: FOOTER_BOTTOM,
      size,
      font: fontReg,
      color: C.footer,
    });
  }
}

/**
 * Druckvorlage: Session-Tabelle mit Raster, warmem Hintergrund, Progression-Kasten.
 */
export async function buildWorkoutLogPdf(result: WorkoutAnalysisResult): Promise<Uint8Array> {
  const prescription = result.next_session_prescription ?? [];
  const pdf = await PDFDocument.create();
  const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4.w, A4.h]);
  drawPageBackground(page);
  const xs = colXs();

  const headers = [
    "Übung",
    "Ziel (Vorgabe)",
    "Satz 1",
    "Satz 2",
    "Satz 3",
    "Satz 4",
    "Gefühl / Notizen",
  ];
  const colWidths = [
    COLS.exercise,
    COLS.target,
    COLS.s1,
    COLS.s2,
    COLS.s3,
    COLS.s4,
    COLS.notes,
  ];

  let yTop = 46;

  const title = "Trainings-Log: Nächste Session (Vorschlag)";
  const titleW = fontBold.widthOfTextAtSize(title, TITLE);
  const accentW = Math.min(titleW, A4.w - 2 * MARGIN);
  const titleBaseline = A4.h - yTop - TITLE * 0.85;
  page.drawText(title, {
    x: MARGIN,
    y: titleBaseline,
    size: TITLE,
    font: fontBold,
    color: C.title,
  });
  page.drawRectangle({
    x: MARGIN,
    y: A4.h - yTop - 6,
    width: accentW,
    height: 3.5,
    color: C.accent,
  });
  yTop += TITLE + 10;

  const stamp = new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  page.drawText(stamp, {
    x: MARGIN,
    y: A4.h - yTop - SUB * 0.75,
    size: SUB,
    font: fontReg,
    color: C.muted,
  });
  yTop += SUB + 22;

  const ensureTableSpace = (h: number) => {
    if (A4.h - yTop - h < MARGIN + CONTENT_BOTTOM_RESERVE) {
      page = pdf.addPage([A4.w, A4.h]);
      drawPageBackground(page);
      yTop = 46;
      drawTableHeader(page, yTop, xs, colWidths, headers, fontBold);
      yTop += HEADER_ROW_H + 1;
    }
  };

  const ensureContentSpace = (h: number) => {
    if (A4.h - yTop - h < MARGIN + CONTENT_BOTTOM_RESERVE) {
      page = pdf.addPage([A4.w, A4.h]);
      drawPageBackground(page);
      yTop = 46;
    }
  };

  ensureTableSpace(HEADER_ROW_H + 8);
  drawTableHeader(page, yTop, xs, colWidths, headers, fontBold);
  yTop += HEADER_ROW_H + 1;

  const rows: NextSessionPrescriptionItem[] =
    prescription.length > 0
      ? prescription
      : [
          {
            exercise_name: "—",
            target_sets: "—",
            target_reps: "—",
            suggested_weight: "—",
            rationale: "Keine Vorschlagszeilen in der Analyse.",
          },
        ];

  rows.forEach((row, idx) => {
    const rowH = measurePrescriptionRowHeight(row, fontReg);
    ensureTableSpace(rowH + 4);
    drawPrescriptionRow(page, yTop, row, rowH, xs, fontReg, idx % 2 === 0);
    yTop += rowH + 0.5;
  });

  page.drawLine({
    start: { x: MARGIN, y: A4.h - yTop },
    end: { x: A4.w - MARGIN, y: A4.h - yTop },
    thickness: 0.45,
    color: C.grid,
  });
  yTop += 18;
  ensureContentSpace(90);

  page.drawText("Progression & Einblicke", {
    x: MARGIN,
    y: A4.h - yTop - 9,
    size: 11.5,
    font: fontBold,
    color: C.title,
  });
  yTop += 22;

  const bullets = progressionBullets(result.progressive_overload_analysis);
  const boxPad = 12;
  const bulletSize = 9.5;
  const bulletParaLine = 12;
  const bulletGap = 6;
  const innerW = A4.w - 2 * MARGIN - 2 * boxPad - 10;
  let progressionContentH = boxPad * 2;
  const bulletLayouts: { lines: string[] }[] = [];
  for (const b of bullets) {
    const raw = b.trim();
    if (!raw) continue;
    const lines = wrapTextToLines(`• ${raw}`, fontReg, bulletSize, innerW, 12);
    bulletLayouts.push({ lines });
    progressionContentH += lines.length * bulletParaLine + bulletGap;
  }
  if (bulletLayouts.length === 0) {
    bulletLayouts.push({ lines: ["• —"] });
    progressionContentH += bulletParaLine + bulletGap;
  }
  progressionContentH -= bulletGap;
  const boxH = Math.max(40, progressionContentH);

  ensureContentSpace(boxH + 28);
  page.drawRectangle({
    x: MARGIN,
    y: A4.h - yTop - boxH,
    width: A4.w - 2 * MARGIN,
    height: boxH,
    color: C.boxBg,
    borderColor: C.boxBorder,
    borderWidth: 0.55,
  });

  let lineFromTop = yTop + boxPad + 2;
  bulletLayouts.forEach((bl, bi) => {
    for (const line of bl.lines) {
      const baseline = A4.h - lineFromTop - bulletSize * 0.75;
      page.drawText(line, {
        x: MARGIN + boxPad,
        y: baseline,
        size: bulletSize,
        font: fontReg,
        color: rgb(0.18, 0.19, 0.22),
      });
      lineFromTop += bulletParaLine;
    }
    if (bi < bulletLayouts.length - 1) lineFromTop += bulletGap;
  });
  yTop += boxH + 22;

  const tips = (result.coach_tips ?? []).filter((t) => t.trim()).slice(0, 6);
  if (tips.length > 0) {
    ensureContentSpace(28 + 8);
    page.drawText("Coach-Tipps", {
      x: MARGIN,
      y: A4.h - yTop - 9,
      size: 11.5,
      font: fontBold,
      color: C.title,
    });
    yTop += 22;

    const tipSize = 9;
    const tipLineH = 11;
    let tipsBoxH = boxPad * 2;
    const tipLayouts: string[][] = [];
    for (const tip of tips) {
      const lines = wrapTextToLines(tip, fontReg, tipSize, innerW, 4);
      tipLayouts.push(lines);
      tipsBoxH += lines.length * tipLineH + 8;
    }
    tipsBoxH -= 8;
    tipsBoxH = Math.max(36, tipsBoxH);

    ensureContentSpace(tipsBoxH + 20);
    page.drawRectangle({
      x: MARGIN,
      y: A4.h - yTop - tipsBoxH,
      width: A4.w - 2 * MARGIN,
      height: tipsBoxH,
      color: C.boxBg,
      borderColor: C.boxBorder,
      borderWidth: 0.55,
    });
    let tipTop = yTop + boxPad + 2;
    for (const lines of tipLayouts) {
      for (const line of lines) {
        const baseline = A4.h - tipTop - tipSize * 0.75;
        page.drawText(line, {
          x: MARGIN + boxPad,
          y: baseline,
          size: tipSize,
          font: fontReg,
          color: rgb(0.18, 0.19, 0.22),
        });
        tipTop += tipLineH;
      }
      tipTop += 8;
    }
    yTop += tipsBoxH + 22;
  }

  ensureContentSpace(36);
  page.drawLine({
    start: { x: MARGIN, y: A4.h - yTop },
    end: { x: A4.w - MARGIN, y: A4.h - yTop },
    thickness: 0.4,
    color: C.grid,
  });
  yTop += 10;

  ensureContentSpace(14);
  page.drawText("Blatt speichern / scannen und wieder in die App laden.", {
    x: MARGIN,
    y: A4.h - yTop - 9,
    size: 9,
    font: fontReg,
    color: C.footer,
  });

  const totalPages = pdf.getPageCount();
  drawPageFooters(pdf, fontReg, totalPages);

  const bytes = await pdf.save();
  return bytes;
}
