type Row = {
  date: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
};

function escapeCsvCell(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}

export function buildWorkoutCsv(rows: Row[]): string {
  const header = ["Datum", "Übung", "Sätze", "Wiederholungen", "Gewicht"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.date),
        escapeCsvCell(r.name),
        escapeCsvCell(r.sets),
        escapeCsvCell(r.reps),
        escapeCsvCell(r.weight),
      ].join(","),
    );
  }
  return "\uFEFF" + lines.join("\n");
}
