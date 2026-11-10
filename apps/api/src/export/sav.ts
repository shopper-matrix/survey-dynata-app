import type { CellValue, Column, ExportRow } from './columns.js';

// Minimal SPSS system-file (.sav) writer: uncompressed, little-endian, UTF-8, numeric and
// string variables (max 255 bytes), variable labels, value labels and long variable names.
// Layout follows the documented format (GNU PSPP "System File Format").

const SYSMIS = -Number.MAX_VALUE;
/** Seconds from the SPSS epoch (14 Oct 1582) to the Unix epoch. */
const SPSS_EPOCH_OFFSET_SECONDS = 12_219_379_200;
const MAX_LABEL_BYTES = 255;
const MAX_VALUE_LABEL_BYTES = 120;

const FORMAT_TYPE = { string: 1, numeric: 5, datetime: 22 } as const;

class Writer {
  private chunks: Buffer[] = [];

  int32(value: number): this {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32LE(value);
    this.chunks.push(buffer);
    return this;
  }

  float64(value: number): this {
    const buffer = Buffer.alloc(8);
    buffer.writeDoubleLE(value);
    this.chunks.push(buffer);
    return this;
  }

  /** Bytes padded with spaces (or cut) to exactly `length`. */
  text(value: string | Buffer, length: number): this {
    const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    const buffer = Buffer.alloc(length, 0x20);
    bytes.copy(buffer, 0, 0, Math.min(bytes.length, length));
    this.chunks.push(buffer);
    return this;
  }

  bytes(buffer: Buffer): this {
    this.chunks.push(buffer);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

/** UTF-8 bytes cut at a character boundary. */
function utf8(text: string, maxBytes: number): Buffer {
  let bytes = Buffer.from(text, 'utf8');
  if (bytes.length <= maxBytes) return bytes;
  let end = maxBytes;
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
  bytes = bytes.subarray(0, end);
  return bytes;
}

const pad = (length: number, unit: number) => Math.ceil(length / unit) * unit;
const segmentsOf = (column: Column) =>
  column.kind === 'string' ? pad(column.width ?? 8, 8) / 8 : 1;

function printFormat(column: Column): number {
  if (column.kind === 'string') return (FORMAT_TYPE.string << 16) | ((column.width ?? 8) << 8);
  if (column.format === 'datetime') return (FORMAT_TYPE.datetime << 16) | (20 << 8);
  const decimals = column.format === 'decimal' ? 2 : 0;
  return (FORMAT_TYPE.numeric << 16) | (10 << 8) | decimals;
}

const shortName = (index: number) => `V${String(index + 1)}`;

function numericCell(column: Column, value: CellValue): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return SYSMIS;
  return column.format === 'datetime' ? value / 1000 + SPSS_EPOCH_OFFSET_SECONDS : value;
}

export function writeSav(
  columns: Column[],
  rows: ExportRow[],
  fileLabel: string,
  now = new Date(),
): Buffer {
  const out = new Writer();
  const caseSize = columns.reduce((sum, column) => sum + segmentsOf(column), 0);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const two = (n: number) => String(n).padStart(2, '0');

  // File header.
  out
    .text('$FL2', 4)
    .text('@(#) SPSS DATA FILE survey-dynata-app', 60)
    .int32(2) // layout code
    .int32(caseSize)
    .int32(0) // uncompressed
    .int32(0) // no weight variable
    .int32(rows.length)
    .float64(100) // compression bias
    .text(
      `${two(now.getUTCDate())} ${months[now.getUTCMonth()] ?? 'Jan'} ${two(now.getUTCFullYear() % 100)}`,
      9,
    )
    .text(`${two(now.getUTCHours())}:${two(now.getUTCMinutes())}:${two(now.getUTCSeconds())}`, 8)
    .text(utf8(fileLabel, 64), 64)
    .text('', 3);

  // Variable records (strings longer than 8 bytes get continuation records).
  const dictionaryIndex: number[] = [];
  let position = 1;
  columns.forEach((column, index) => {
    dictionaryIndex.push(position);
    const label = utf8(column.label, MAX_LABEL_BYTES);
    out
      .int32(2)
      .int32(column.kind === 'string' ? (column.width ?? 8) : 0)
      .int32(1) // has a label
      .int32(0) // no missing values
      .int32(printFormat(column))
      .int32(printFormat(column))
      .text(shortName(index), 8)
      .int32(label.length)
      .bytes(label)
      .text('', pad(label.length, 4) - label.length);
    for (let segment = 1; segment < segmentsOf(column); segment++) {
      out.int32(2).int32(-1).int32(0).int32(0).int32(0).int32(0).text('', 8);
    }
    position += segmentsOf(column);
  });

  // Value labels (numeric variables only).
  columns.forEach((column, index) => {
    if (column.kind !== 'numeric' || !column.valueLabels?.length) return;
    out.int32(3).int32(column.valueLabels.length);
    for (const [value, text] of column.valueLabels) {
      const label = utf8(text, MAX_VALUE_LABEL_BYTES);
      out
        .float64(value)
        .bytes(Buffer.from([label.length]))
        .bytes(label);
      out.text('', pad(label.length + 1, 8) - label.length - 1);
    }
    out
      .int32(4)
      .int32(1)
      .int32(dictionaryIndex[index] ?? 1);
  });

  // Machine integer info (subtype 3): version 1.0.0, IEEE floats, little-endian, UTF-8.
  out.int32(7).int32(3).int32(4).int32(8);
  for (const value of [1, 0, 0, -1, 1, 1, 2, 65001]) out.int32(value);
  // Machine floating-point info (subtype 4): system-missing, highest, lowest.
  out
    .int32(7)
    .int32(4)
    .int32(8)
    .int32(3)
    .float64(SYSMIS)
    .float64(Number.MAX_VALUE)
    .float64(-1.7976931348623155e308);
  // Long variable names (subtype 13).
  const longNames = Buffer.from(
    columns.map((column, index) => `${shortName(index)}=${column.name}`).join('\t'),
    'utf8',
  );
  out.int32(7).int32(13).int32(1).int32(longNames.length).bytes(longNames);
  // Character encoding (subtype 20).
  const encoding = Buffer.from('UTF-8', 'utf8');
  out.int32(7).int32(20).int32(1).int32(encoding.length).bytes(encoding);
  // End of dictionary.
  out.int32(999).int32(0);

  // Data: 8 bytes per numeric value; strings padded with spaces to their segment size.
  for (const row of rows) {
    for (const column of columns) {
      const value = column.value(row);
      if (column.kind === 'numeric') out.float64(numericCell(column, value));
      else
        out.text(
          utf8(value === null ? '' : String(value), column.width ?? 8),
          segmentsOf(column) * 8,
        );
    }
  }
  return out.toBuffer();
}
