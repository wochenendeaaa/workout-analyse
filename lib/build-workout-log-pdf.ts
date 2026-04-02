import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";

import type { NextSessionPrescriptionItem, WorkoutAnalysisResult } from "@/lib/types/analysis";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42;
const FOOTER_BOTTOM = 22;
const CONTENT_BOTTOM_RESERVE = FOOTER_BOTTOM + 14;
/** Vertikaler Akzent links an Übungs-/Sektionsblöcken */
const ACCENT_BAR_W = 3.5;

const LABEL = 7;
const BRAND = 9;
const BRAND_SUB = 8;
const META = 10;
const EX_NAME = 11.5;
const EX_TARGET = 10;
const EX_BADGE = 6.5;
const CELL_LABEL = 7;
const CELL_LINE = 9;
const SECTION = 11.5;
const BULLET = 9.5;
const TIP = 9;
const FOOT = 9;

const EX_NAME_LINE = 14;
const EX_TARGET_H = 14;
const EX_BLOCK_PAD = 10;
const EX_GRID_GAP = 8;
const EX_CELL_ROWS = 2;
const EX_RUL_LINES = 4;
const BADGE_PAD_X = 8;
const BADGE_PAD_Y = 4;

const C = {
  pageBg: rgb(0.99, 0.99, 0.99),
  charcoal: rgb(0.12, 0.14, 0.18),
  terracotta: rgb(0.72, 0.38, 0.28),
  accentBlue: rgb(0.12, 0.45, 0.62),
  muted: rgb(0.48, 0.5, 0.54),
  labelGray: rgb(0.55, 0.57, 0.6),
  boxBg: rgb(0.94, 0.95, 0.96),
  boxBorder: rgb(0.78, 0.8, 0.84),
  gridLine: rgb(0.88, 0.89, 0.91),
  cellBg: rgb(0.98, 0.98, 0.99),
  footer: rgb(0.45, 0.47, 0.5),
  placeholder: rgb(0.72, 0.74, 0.78),
  badgeBg: rgb(0.92, 0.93, 0.94),
  insightGreen: rgb(0.35, 0.65, 0.45),
  insightOrange: rgb(0.85, 0.55, 0.25),
  insightBlue: rgb(0.35, 0.55, 0.75),
};

function truncateToWidth(text: string, font: PDFFont, size: number, maxW: number): string {
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

function drawPageBackground(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: C.pageBg });
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

function makeDocId(): string {
  const t = Date.now().toString(36).toUpperCase().slice(-8);
  return `WA-${t}`;
}

/** Innenbreite eines Übungsblocks (ohne linken Seitenrand, mit Platz für Akzentbalken) */
function exerciseInnerX(): number {
  return MARGIN + ACCENT_BAR_W + 10;
}

function exerciseInnerW(): number {
  return A4.w - exerciseInnerX() - MARGIN;
}

function measureExerciseBlockHeight(row: NextSessionPrescriptionItem, fontBold: PDFFont): number {
  const iw = exerciseInnerW();
  const nameLines = wrapTextToLines(`88. ${row.exercise_name}`, fontBold, EX_NAME, iw, 2);
  let h = EX_BLOCK_PAD;
  h += nameLines.length * EX_NAME_LINE;
  h += 8;
  h += EX_TARGET_H;
  const rat = row.rationale?.trim() ?? "";
  if (rat) {
    h += EX_BADGE + BADGE_PAD_Y * 2 + 8;
  }
  h += 8;
  const cellH = measureGridCellHeight();
  h += EX_CELL_ROWS * cellH + EX_GRID_GAP;
  h += EX_BLOCK_PAD;
  return h;
}

function measureGridCellHeight(): number {
  const labelH = 12;
  const linesH = EX_RUL_LINES * (CELL_LINE + 2);
  return labelH + linesH + 8;
}

function drawRuledCell(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  label: string,
  fontBold: PDFFont,
) {
  page.drawRectangle({
    x,
    y: A4.h - yTop - h,
    width: w,
    height: h,
    color: C.cellBg,
    borderColor: C.boxBorder,
    borderWidth: 0.45,
  });
  const lb = A4.h - yTop - 10;
  page.drawText(label, {
    x: x + 6,
    y: lb,
    size: CELL_LABEL,
    font: fontBold,
    color: C.labelGray,
  });
  const lineStart = yTop + 18;
  for (let i = 0; i < EX_RUL_LINES; i++) {
    const ly = lineStart + i * (CELL_LINE + 2);
    page.drawLine({
      start: { x: x + 6, y: A4.h - ly },
      end: { x: x + w - 6, y: A4.h - ly },
      thickness: 0.25,
      color: C.gridLine,
    });
  }
}

function drawExerciseBlock(
  page: PDFPage,
  yTop: number,
  index: number,
  row: NextSessionPrescriptionItem,
  fontBold: PDFFont,
  fontReg: PDFFont,
): number {
  const blockH = measureExerciseBlockHeight(row, fontBold);
  const x0 = MARGIN;
  const iw = exerciseInnerW();
  const ix = exerciseInnerX();

  page.drawRectangle({
    x: x0,
    y: A4.h - yTop - blockH,
    width: A4.w - 2 * MARGIN,
    height: blockH,
    color: rgb(0.995, 0.995, 0.995),
    borderColor: C.boxBorder,
    borderWidth: 0.4,
  });
  page.drawRectangle({
    x: x0 + 2,
    y: A4.h - yTop - blockH + 4,
    width: ACCENT_BAR_W,
    height: blockH - 8,
    color: C.charcoal,
  });

  let cursor = yTop + EX_BLOCK_PAD;
  const num = String(index + 1).padStart(2, "0");
  const nameLines = wrapTextToLines(row.exercise_name, fontBold, EX_NAME, iw, 2);
  for (const line of nameLines) {
    const t = truncateToWidth(line, fontBold, EX_NAME, iw);
    page.drawText(`${num}. ${t}`, {
      x: ix,
      y: A4.h - cursor - EX_NAME * 0.75,
      size: EX_NAME,
      font: fontBold,
      color: C.charcoal,
    });
    cursor += EX_NAME_LINE;
  }
  if (nameLines.length === 1) cursor += EX_NAME_LINE;
  cursor += 4;

  const targetStr = `Target: ${row.target_sets} × ${row.target_reps} @ ${row.suggested_weight}`;
  page.drawText(truncateToWidth(targetStr, fontReg, EX_TARGET, iw), {
    x: ix,
    y: A4.h - cursor - EX_TARGET * 0.75,
    size: EX_TARGET,
    font: fontReg,
    color: C.terracotta,
  });
  cursor += EX_TARGET_H;

  const rat = row.rationale?.trim() ?? "";
  if (rat) {
    const badgeText = (rat.length > 48 ? `${rat.slice(0, 45)}…` : rat).toUpperCase();
    const bw = Math.min(iw - 4, fontReg.widthOfTextAtSize(badgeText, EX_BADGE) + BADGE_PAD_X * 2);
    const bh = EX_BADGE + BADGE_PAD_Y * 2;
    cursor += 4;
    page.drawRectangle({
      x: ix,
      y: A4.h - cursor - bh,
      width: bw,
      height: bh,
      color: C.badgeBg,
      borderColor: C.boxBorder,
      borderWidth: 0.35,
    });
    page.drawText(badgeText, {
      x: ix + BADGE_PAD_X,
      y: A4.h - cursor - BADGE_PAD_Y - EX_BADGE * 0.75,
      size: EX_BADGE,
      font: fontReg,
      color: C.muted,
    });
    cursor += bh + 4;
  }

  cursor += 4;
  const cellH = measureGridCellHeight();
  const gap = EX_GRID_GAP;
  const colW = (iw - gap) / 2;

  drawRuledCell(page, ix, cursor, colW, cellH, "SET 1", fontBold);
  drawRuledCell(page, ix + colW + gap, cursor, colW, cellH, "SET 2", fontBold);
  cursor += cellH + gap;
  drawRuledCell(page, ix, cursor, colW, cellH, "SET 3", fontBold);
  drawRuledCell(page, ix + colW + gap, cursor, colW, cellH, "NOTIZEN / RPE", fontBold);

  return blockH;
}

function measureProgressionSectionHeight(
  bullets: string[],
  fontReg: PDFFont,
  innerW: number,
): { titleAndGap: number; boxH: number } {
  const boxPad = 12;
  const bulletParaLine = 12;
  const bulletGap = 6;
  let progressionContentH = boxPad * 2;
  for (const b of bullets) {
    const raw = b.trim();
    if (!raw) continue;
    const lines = wrapTextToLines(`• ${raw}`, fontReg, BULLET, innerW, 12);
    progressionContentH += lines.length * bulletParaLine + bulletGap;
  }
  if (progressionContentH <= boxPad * 2) {
    progressionContentH += bulletParaLine + bulletGap;
  }
  progressionContentH -= bulletGap;
  const boxH = Math.max(40, progressionContentH);
  return { titleAndGap: 26, boxH };
}

function measureCoachSectionHeight(tips: string[], fontReg: PDFFont, innerW: number): { titleAndGap: number; boxH: number } {
  const boxPad = 12;
  const tipLineH = 11;
  let tipsBoxH = boxPad * 2;
  for (const tip of tips) {
    const lines = wrapTextToLines(tip, fontReg, TIP, innerW, 4);
    tipsBoxH += lines.length * tipLineH + 8;
  }
  tipsBoxH -= 8;
  tipsBoxH = Math.max(36, tipsBoxH);
  return { titleAndGap: 28, boxH: tipsBoxH };
}

function measureJournalNotesHeight(): number {
  const header = 22;
  const boxH = 88;
  return header + boxH + 16;
}

/**
 * Trainings-Log PDF: Header im Report-Stil, Übungsblöcke mit 2×2-Set-Grid, Insights & Coach-Tipps.
 */
export async function buildWorkoutLogPdf(result: WorkoutAnalysisResult): Promise<Uint8Array> {
  const prescription = result.next_session_prescription ?? [];
  const pdf = await PDFDocument.create();
  const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4.w, A4.h]);
  drawPageBackground(page);

  let yTop = 40;
  const docId = makeDocId();
  const locationLabel =
    process.env.PDF_LOCATION_LABEL?.trim() || "Training";

  const brand = "WORKOUT ANALYZER";
  const sub = "OFFICIAL TRAINING REPORT";
  page.drawText(brand, {
    x: MARGIN,
    y: A4.h - yTop - BRAND * 0.75,
    size: BRAND,
    font: fontBold,
    color: C.charcoal,
  });
  page.drawText(sub, {
    x: MARGIN,
    y: A4.h - yTop - BRAND - BRAND_SUB * 0.75,
    size: BRAND_SUB,
    font: fontBold,
    color: C.terracotta,
  });
  const idText = `DOCUMENT ID / ${docId}`;
  const idW = fontReg.widthOfTextAtSize(idText, LABEL);
  page.drawText(idText, {
    x: A4.w - MARGIN - idW,
    y: A4.h - yTop - LABEL * 0.75,
    size: LABEL,
    font: fontReg,
    color: C.labelGray,
  });
  yTop += BRAND + BRAND_SUB + 16;

  const sessionTitle = "Trainings-Log: Nächste Session (Vorschlag)";
  const stamp = new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });

  const labelRow = (label: string, value: string, valueBold: boolean) => {
    page.drawText(label.toUpperCase(), {
      x: MARGIN,
      y: A4.h - yTop - LABEL * 0.75,
      size: LABEL,
      font: fontReg,
      color: C.labelGray,
    });
    yTop += 11;
    page.drawText(value, {
      x: MARGIN,
      y: A4.h - yTop - META * 0.75,
      size: META,
      font: valueBold ? fontBold : fontReg,
      color: C.charcoal,
    });
    yTop += META + 8;
  };

  labelRow("SESSION TITLE", sessionTitle, true);
  labelRow("DATE & TIME", stamp, false);
  labelRow("LOCATION", locationLabel, false);

  page.drawLine({
    start: { x: MARGIN, y: A4.h - yTop },
    end: { x: A4.w - MARGIN, y: A4.h - yTop },
    thickness: 0.6,
    color: C.charcoal,
  });
  yTop += 20;

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

  const innerW = A4.w - 2 * MARGIN - 24;

  const ensureSpace = (h: number) => {
    if (A4.h - yTop - h < MARGIN + CONTENT_BOTTOM_RESERVE) {
      page = pdf.addPage([A4.w, A4.h]);
      drawPageBackground(page);
      yTop = 46;
    }
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const bh = measureExerciseBlockHeight(row, fontBold) + 12;
    ensureSpace(bh);
    drawExerciseBlock(page, yTop, i, row, fontBold, fontReg);
    yTop += measureExerciseBlockHeight(row, fontBold) + 12;
  }

  yTop += 8;

  const bullets = progressionBullets(result.progressive_overload_analysis);
  const bulletLayouts: { lines: string[] }[] = [];
  for (const b of bullets) {
    const raw = b.trim();
    if (!raw) continue;
    const lines = wrapTextToLines(`• ${raw}`, fontReg, BULLET, innerW, 12);
    bulletLayouts.push({ lines });
  }
  if (bulletLayouts.length === 0) {
    bulletLayouts.push({ lines: ["• —"] });
  }

  const progMeasured = measureProgressionSectionHeight(
    bullets.length ? bullets : ["—"],
    fontReg,
    innerW,
  );
  const progTotalH = progMeasured.titleAndGap + progMeasured.boxH + 20;

  ensureSpace(progTotalH);

  page.drawRectangle({
    x: MARGIN,
    y: A4.h - yTop - 14,
    width: ACCENT_BAR_W,
    height: 14,
    color: C.accentBlue,
  });
  page.drawText("Progression & Einblicke", {
    x: MARGIN + ACCENT_BAR_W + 8,
    y: A4.h - yTop - 9,
    size: SECTION,
    font: fontBold,
    color: C.charcoal,
  });
  yTop += 22;

  const boxPad = 12;
  const bulletParaLine = 12;
  const bulletGap = 6;
  const boxH = progMeasured.boxH;

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
      const baseline = A4.h - lineFromTop - BULLET * 0.75;
      page.drawText(line, {
        x: MARGIN + boxPad,
        y: baseline,
        size: BULLET,
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
    const coachMeasured = measureCoachSectionHeight(tips, fontReg, innerW - 14);
    const coachTotal = coachMeasured.titleAndGap + coachMeasured.boxH + 20;
    ensureSpace(coachTotal);

    page.drawRectangle({
      x: MARGIN,
      y: A4.h - yTop - 14,
      width: ACCENT_BAR_W,
      height: 14,
      color: C.terracotta,
    });
    page.drawText("COACH-TIPPS", {
      x: MARGIN + ACCENT_BAR_W + 8,
      y: A4.h - yTop - 8,
      size: LABEL,
      font: fontBold,
      color: C.labelGray,
    });
    yTop += 12;
    page.drawText("Insights & Coach Tips", {
      x: MARGIN + ACCENT_BAR_W + 8,
      y: A4.h - yTop - 10,
      size: SECTION,
      font: fontBold,
      color: C.charcoal,
    });
    yTop += 22;

    const tipsBoxH = coachMeasured.boxH;
    const tipLineH = 11;
    const tipLayouts: string[][] = [];
    for (const tip of tips) {
      tipLayouts.push(wrapTextToLines(tip, fontReg, TIP, innerW - 14, 4));
    }

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
    const accentColors = [C.insightGreen, C.insightOrange, C.insightBlue];
    let tipIdx = 0;
    for (const lines of tipLayouts) {
      const ac = accentColors[tipIdx % accentColors.length];
      page.drawRectangle({
        x: MARGIN + boxPad,
        y: A4.h - tipTop - 8,
        width: 4,
        height: 8,
        color: ac,
      });
      tipIdx++;
      for (const line of lines) {
        const baseline = A4.h - tipTop - TIP * 0.75;
        page.drawText(line, {
          x: MARGIN + boxPad + 10,
          y: baseline,
          size: TIP,
          font: fontReg,
          color: rgb(0.18, 0.19, 0.22),
        });
        tipTop += tipLineH;
      }
      tipTop += 8;
    }
    yTop += tipsBoxH + 22;
  }

  const journalH = measureJournalNotesHeight();
  ensureSpace(journalH);

  page.drawText("ABSCHLUSS-GEDANKEN / JOURNAL", {
    x: MARGIN,
    y: A4.h - yTop - 9,
    size: SECTION,
    font: fontBold,
    color: C.charcoal,
  });
  yTop += 22;

  const jBoxH = 88;
  page.drawRectangle({
    x: MARGIN,
    y: A4.h - yTop - jBoxH,
    width: A4.w - 2 * MARGIN,
    height: jBoxH,
    color: rgb(1, 1, 1),
    borderColor: C.boxBorder,
    borderWidth: 0.55,
  });
  for (let j = 0; j < 5; j++) {
    const ly = yTop + 16 + j * 14;
    page.drawLine({
      start: { x: MARGIN + 10, y: A4.h - ly },
      end: { x: A4.w - MARGIN - 10, y: A4.h - ly },
      thickness: 0.25,
      color: C.gridLine,
    });
  }
  page.drawText("Notizen zu Wohlbefinden, Schlaf oder Intensität …", {
    x: MARGIN + 12,
    y: A4.h - yTop - 12,
    size: 8,
    font: fontReg,
    color: C.placeholder,
  });
  yTop += jBoxH + 18;

  ensureSpace(36);
  page.drawLine({
    start: { x: MARGIN, y: A4.h - yTop },
    end: { x: A4.w - MARGIN, y: A4.h - yTop },
    thickness: 0.4,
    color: C.gridLine,
  });
  yTop += 12;

  ensureSpace(16);
  page.drawText("BLATT SPEICHERN / SCANNEN UND WIEDER IN DIE APP LADEN.", {
    x: MARGIN,
    y: A4.h - yTop - FOOT * 0.75,
    size: FOOT,
    font: fontReg,
    color: C.footer,
  });

  const totalPages = pdf.getPageCount();
  drawPageFooters(pdf, fontReg, totalPages);

  return pdf.save();
}
