import { NextResponse } from 'next/server';
import Airtable, { FieldSet } from 'airtable';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const SESSIONS_TABLE = process.env.AIRTABLE_TABLE_SESSIONS ?? 'Session';

if (!API_KEY || !BASE_ID) {
  throw new Error('Airtable credentials are not configured');
}

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

interface SessionFields extends FieldSet {
  year?: number;
  month?: number;
  day?: number;
  userId?: string;
  username?: string;
  sitename?: string;
  workdescription?: string;
  clockInAt?: string;
  clockOutAt?: string;
  hours?: number;
}

type FormatType = 'xlsx' | 'csv';

type ReportRow = {
  dateLabel: string;
  dateSerial: number | null;
  username: string;
  userId: string;
  sitename: string;
  workdescription: string;
  clockInIso: string;
  clockOutIso: string;
  clockInDisplay: string;
  clockOutDisplay: string;
  clockInSerial: number | null;
  clockOutSerial: number | null;
  hours: number | null;
  hoursDisplay: string;
};

type SummaryRow = {
  category: string;
  name: string;
  hours: number | null;
  hoursDisplay: string;
};

type CellData =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number; style: number };

type ZipEntry = { name: string; data: Uint8Array };

const textEncoder = new TextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 1) !== 0) {
        crc = 0xedb88320 ^ (crc >>> 1);
      } else {
        crc >>>= 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8(arrays: readonly Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function createZip(entries: readonly ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0014, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatUint8(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatUint8([...localParts, centralDirectory, end]);
}

function parseFormat(value: string | null): FormatType {
  if (!value) return 'xlsx';
  const lowered = value.toLowerCase();
  return lowered === 'csv' ? 'csv' : 'xlsx';
}

function encodeFormulaValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= 3) {
      throw error;
    }
    const delay = 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, attempt + 1);
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function buildDateLabel(year: number, month: number, day: number | undefined): string {
  if (!day) {
    return `${year}-${pad(month)}-??`;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function excelSerialFromDate(date: Date): number | null {
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return time / 86400000 + 25569;
}

function excelSerialFromParts(year: number, month: number, day: number): number {
  const utc = Date.UTC(year, month - 1, day);
  return utc / 86400000 + 25569;
}

function formatDateTime(value: string): { display: string; serial: number | null } {
  if (!value) {
    return { display: '', serial: null };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { display: value, serial: null };
  }
  const serial = excelSerialFromDate(date);
  const display = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return { display, serial };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetter(index: number): string {
  let n = index;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function numberToString(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  const text = value.toString();
  if (text.includes('e') || text.includes('E')) {
    return value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  }
  return text;
}

function buildWorksheetXml(options: {
  header: readonly string[];
  rows: readonly (readonly (CellData | null)[])[];
  columnWidths: readonly number[];
  autoFilterRef: string;
  tabSelected?: boolean;
}): string {
  const { header, rows, columnWidths, autoFilterRef, tabSelected } = options;
  const headerCells = header
    .map((text, idx) => {
      const cellRef = `${columnLetter(idx + 1)}1`;
      return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
    })
    .join('');
  const headerRow = `<row r="1">${headerCells}</row>`;

  const dataRows = rows
    .map((row, rowIdx) => {
      const cells = row
        .map((cell, colIdx) => {
          if (!cell) {
            return '';
          }
          const cellRef = `${columnLetter(colIdx + 1)}${rowIdx + 2}`;
          if (cell.type === 'string') {
            if (cell.value === '') {
              return '';
            }
            return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
          }
          const styleAttr = cell.style != null ? ` s="${cell.style}"` : '';
          return `<c r="${cellRef}"${styleAttr}><v>${numberToString(cell.value)}</v></c>`;
        })
        .join('');
      return `<row r="${rowIdx + 2}">${cells}</row>`;
    })
    .join('');

  const dimensionRef = `${columnLetter(header.length)}${rows.length + 1}`;
  const cols = columnWidths
    .map((width, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${width.toFixed(2)}" customWidth="1"/>`)
    .join('');

  const sheetView = `<sheetViews><sheetView workbookViewId="0"${tabSelected ? ' tabSelected="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<dimension ref="A1:${dimensionRef}"/>`
    + sheetView
    + `<sheetFormatPr baseColWidth="10" defaultRowHeight="15"/>`
    + `<cols>${cols}</cols>`
    + `<sheetData>${headerRow}${dataRows}</sheetData>`
    + `<autoFilter ref="${autoFilterRef}"/>`
    + `</worksheet>`;
}

function buildStylesXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="3">'
    + '<numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>'
    + '<numFmt numFmtId="166" formatCode="yyyy-mm-dd\" \"hh:mm"/>'
    + '<numFmt numFmtId="167" formatCode="0.00"/>'
    + '</numFmts>'
    + '<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>'
    + '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="4">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>'
  );
}

function buildWorkbookBuffer(reportRows: readonly ReportRow[], summaryRows: readonly SummaryRow[]): Uint8Array {
  const header = [
    '日付(YYYY-MM-DD)',
    'ユーザー名',
    'ユーザーID',
    '現場名',
    '作業内容',
    '出勤(ISO)',
    '退勤(ISO)',
    '時間(h)',
  ] as const;

  const columnMax = header.map((label) => Math.max(label.length, 10));
  for (const row of reportRows) {
    columnMax[0] = Math.max(columnMax[0], row.dateLabel.length, 10);
    columnMax[1] = Math.max(columnMax[1], row.username.length, 10);
    columnMax[2] = Math.max(columnMax[2], row.userId.length, 10);
    columnMax[3] = Math.max(columnMax[3], row.sitename.length, 10);
    columnMax[4] = Math.max(columnMax[4], row.workdescription.length, 10);
    columnMax[5] = Math.max(columnMax[5], row.clockInDisplay.length, row.clockInIso.length, 10);
    columnMax[6] = Math.max(columnMax[6], row.clockOutDisplay.length, row.clockOutIso.length, 10);
    columnMax[7] = Math.max(columnMax[7], row.hoursDisplay.length, 10);
  }
  const columnWidths = columnMax.map((len) => Math.min(len, 60) + 2);

  const reportRowCells = reportRows.map<readonly (CellData | null)[]>((row) => [
    row.dateSerial != null ? { type: 'number', value: row.dateSerial, style: 1 } : { type: 'string', value: row.dateLabel },
    row.username ? { type: 'string', value: row.username } : null,
    row.userId ? { type: 'string', value: row.userId } : null,
    row.sitename ? { type: 'string', value: row.sitename } : null,
    row.workdescription ? { type: 'string', value: row.workdescription } : null,
    row.clockInSerial != null
      ? { type: 'number', value: row.clockInSerial, style: 2 }
      : row.clockInIso
      ? { type: 'string', value: row.clockInIso }
      : null,
    row.clockOutSerial != null
      ? { type: 'number', value: row.clockOutSerial, style: 2 }
      : row.clockOutIso
      ? { type: 'string', value: row.clockOutIso }
      : null,
    row.hours != null
      ? { type: 'number', value: row.hours, style: 3 }
      : row.hoursDisplay
      ? { type: 'string', value: row.hoursDisplay }
      : null,
  ]);

  const reportSheet = buildWorksheetXml({
    header,
    rows: reportRowCells,
    columnWidths,
    autoFilterRef: `A1:H${Math.max(1, reportRows.length + 1)}`,
    tabSelected: true,
  });

  const summaryHeader = ['区分', '名称', '合計時間(h)'] as const;
  const summaryMax = summaryHeader.map((label) => Math.max(label.length, 8));
  for (const row of summaryRows) {
    summaryMax[0] = Math.max(summaryMax[0], row.category.length, 8);
    summaryMax[1] = Math.max(summaryMax[1], row.name.length, 8);
    summaryMax[2] = Math.max(summaryMax[2], row.hoursDisplay.length, 8);
  }
  const summaryWidths = summaryMax.map((len) => Math.min(len, 60) + 2);

  const summaryCells = summaryRows.map<readonly (CellData | null)[]>((row) => [
    row.category ? { type: 'string', value: row.category } : null,
    row.name ? { type: 'string', value: row.name } : null,
    row.hours != null
      ? { type: 'number', value: row.hours, style: 3 }
      : row.hoursDisplay
      ? { type: 'string', value: row.hoursDisplay }
      : null,
  ]);

  const summarySheet = buildWorksheetXml({
    header: summaryHeader,
    rows: summaryCells,
    columnWidths: summaryWidths,
    autoFilterRef: `A1:C${Math.max(1, summaryRows.length + 1)}`,
  });

  const stylesXml = buildStylesXml();
  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<fileVersion appName="Calc"/>'
    + '<workbookPr date1904="false"/>'
    + '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="17620"/></bookViews>'
    + '<sheets>'
    + '<sheet name="Report" sheetId="1" r:id="rId1"/>'
    + '<sheet name="Summary" sheetId="2" r:id="rId2"/>'
    + '</sheets>'
    + '</workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    + '</Relationships>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    + '</Types>';

  const timestamp = new Date().toISOString();
  const coreProps =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + `<dc:title>Monthly Report</dc:title>`
    + '<dc:creator>ai-nippo</dc:creator>'
    + '<cp:lastModifiedBy>ai-nippo</cp:lastModifiedBy>'
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>`
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>`
    + '</cp:coreProperties>';

  const appProps =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    + '<Application>Microsoft Excel</Application>'
    + '</Properties>';

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: textEncoder.encode(contentTypes) },
    { name: '_rels/.rels', data: textEncoder.encode(rootRels) },
    { name: 'docProps/core.xml', data: textEncoder.encode(coreProps) },
    { name: 'docProps/app.xml', data: textEncoder.encode(appProps) },
    { name: 'xl/workbook.xml', data: textEncoder.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: textEncoder.encode(workbookRels) },
    { name: 'xl/styles.xml', data: textEncoder.encode(stylesXml) },
    { name: 'xl/worksheets/sheet1.xml', data: textEncoder.encode(reportSheet) },
    { name: 'xl/worksheets/sheet2.xml', data: textEncoder.encode(summarySheet) },
  ];

  return createZip(entries);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const url = new URL(req.url);
  const yearValue = url.searchParams.get('year');
  const monthValue = url.searchParams.get('month');
  const userIdFilter = url.searchParams.get('userId');
  const siteFilterRaw = url.searchParams.get('site');
  const format = parseFormat(url.searchParams.get('format'));

  if (!yearValue || !monthValue) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }

  const year = Number.parseInt(yearValue, 10);
  const month = Number.parseInt(monthValue, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400 });
  }
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'INVALID_MONTH' }, { status: 400 });
  }

  const filterParts = [`{year}=${year}`, `{month}=${month}`];
  if (userIdFilter) {
    filterParts.push(`{userId}='${encodeFormulaValue(userIdFilter)}'`);
  }
  const filterByFormula = `AND(${filterParts.join(',')})`;

  try {
    const records = await withRetry(() =>
      base<SessionFields>(SESSIONS_TABLE)
        .select({
          filterByFormula,
          pageSize: 100,
          sort: [
            { field: 'day', direction: 'asc' },
            { field: 'clockInAt', direction: 'asc' },
          ],
        })
        .all(),
    );

    const siteFilter = siteFilterRaw?.trim().toLowerCase() ?? '';
    const filteredRecords = siteFilter
      ? records.filter((record) => {
          const name = record.fields.sitename ?? '';
          return name.toLowerCase().includes(siteFilter);
        })
      : records;

    const reportRows: ReportRow[] = filteredRecords.map((record) => {
      const fields = record.fields;
      const day = typeof fields.day === 'number' ? fields.day : undefined;
      const dateLabel = buildDateLabel(fields.year ?? year, fields.month ?? month, day);
      const dateSerial = day ? excelSerialFromParts(fields.year ?? year, fields.month ?? month, day) : null;
      const clockIn = formatDateTime(typeof fields.clockInAt === 'string' ? fields.clockInAt : '');
      const clockOut = formatDateTime(typeof fields.clockOutAt === 'string' ? fields.clockOutAt : '');
      const hoursValue = typeof fields.hours === 'number' ? fields.hours : null;
      const hoursDisplay = hoursValue != null ? hoursValue.toFixed(2) : '';

      return {
        dateLabel,
        dateSerial,
        username: fields.username ?? '',
        userId: fields.userId ?? '',
        sitename: fields.sitename ?? '',
        workdescription: fields.workdescription ?? '',
        clockInIso: typeof fields.clockInAt === 'string' ? fields.clockInAt : '',
        clockOutIso: typeof fields.clockOutAt === 'string' ? fields.clockOutAt : '',
        clockInDisplay: clockIn.display,
        clockOutDisplay: clockOut.display,
        clockInSerial: clockIn.serial,
        clockOutSerial: clockOut.serial,
        hours: hoursValue,
        hoursDisplay,
      } satisfies ReportRow;
    });

    const byUser = new Map<string, number>();
    const bySite = new Map<string, number>();
    for (const row of reportRows) {
      const hours = row.hours ?? 0;
      const userKey = row.username || '未登録ユーザー';
      const siteKey = row.sitename || '未設定拠点';
      byUser.set(userKey, (byUser.get(userKey) ?? 0) + hours);
      bySite.set(siteKey, (bySite.get(siteKey) ?? 0) + hours);
    }

    if (format === 'csv') {
      const header = [
        '日付(YYYY-MM-DD)',
        'ユーザー名',
        'ユーザーID',
        '現場名',
        '作業内容',
        '出勤(ISO)',
        '退勤(ISO)',
        '時間(h)',
      ];
      const esc = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };
      const lines = [header.map(esc).join(',')];
      for (const row of reportRows) {
        lines.push(
          [
            row.dateLabel,
            row.username,
            row.userId,
            row.sitename,
            row.workdescription,
            row.clockInIso,
            row.clockOutIso,
            row.hoursDisplay,
          ]
            .map(esc)
            .join(','),
        );
      }
      const csv = lines.join('\n');
      const filename =
        `report-${year}-${pad(month)}`
        + (userIdFilter ? `_user-${encodeURIComponent(userIdFilter)}` : '')
        + (siteFilterRaw ? `_site-${encodeURIComponent(siteFilterRaw)}` : '')
        + '.csv';
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const summaryRows: SummaryRow[] = [];
    summaryRows.push({ category: '---', name: 'ユーザー別', hours: null, hoursDisplay: '---' });
    for (const [name, hours] of [...byUser.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'))) {
      summaryRows.push({ category: 'User', name, hours, hoursDisplay: hours.toFixed(2) });
    }
    summaryRows.push({ category: '---', name: '現場別', hours: null, hoursDisplay: '---' });
    for (const [name, hours] of [...bySite.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'))) {
      summaryRows.push({ category: 'Site', name, hours, hoursDisplay: hours.toFixed(2) });
    }

    const binary = buildWorkbookBuffer(reportRows, summaryRows);
    const arrayBuffer = new ArrayBuffer(binary.byteLength);
    new Uint8Array(arrayBuffer).set(binary);
    const filename =
      `report-${year}-${pad(month)}`
      + (userIdFilter ? `_user-${encodeURIComponent(userIdFilter)}` : '')
      + (siteFilterRaw ? `_site-${encodeURIComponent(siteFilterRaw)}` : '')
      + '.xlsx';

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[reports][month] failed to generate report', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
