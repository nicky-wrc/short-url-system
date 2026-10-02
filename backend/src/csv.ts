export const CSV_EXPORT_LIMIT = 10_000;

// Quote escaping alone does not stop spreadsheet formulas. Prefix before any
// whitespace/control/format characters, including Unicode separators and BOM.
export function csvText(value: string): string {
  const safe = /^[\p{Z}\p{C}\s]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

interface ExportLink {
  title: string; original_url: string; code: string;
  created_at: Date; expires_at: Date | null; clicks: string;
}
export function linksCsv(rows: ExportLink[], baseUrl: string, now: number): string {
  const header = ['ชื่อลิงก์', 'URL ต้นฉบับ', 'Short URL', 'วันที่สร้าง (UTC)', 'วันหมดอายุ (UTC)', 'สถานะ', 'จำนวนครั้งที่เปิด'];
  const lines = [header.map(csvText).join(',')];
  for (const row of rows) {
    const fields = [row.title, row.original_url, `${baseUrl}/${row.code}`, row.created_at.toISOString(),
      row.expires_at?.toISOString() ?? '', row.expires_at && row.expires_at.getTime() <= now ? 'Expired' : 'Active'];
    // COUNT from PostgreSQL is a decimal string: preserve exact numeric digits.
    lines.push([...fields.map(csvText), row.clicks].join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
