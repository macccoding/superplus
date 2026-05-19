import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const laneOrder = ['SUPERVISOR', 'PRICING_CLERK', 'CASHIER', 'PRODUCE_MEAT', 'MERCHANDISER'];

const laneLabels: Record<string, string> = {
  SUPERVISOR: 'SUPERVISOR',
  PRICING_CLERK: 'PRICING CLERK',
  CASHIER: 'CASHIER',
  PRODUCE_MEAT: 'PRODUCE/\nMEAT',
  MERCHANDISER: 'MERCHANDISER',
};

const absenceLabels: Record<string, string> = {
  VACATION_LEAVE: 'VACATION LEAVE',
  SICK_LEAVE: 'SICK LEAVE',
  MATERNITY_LEAVE: 'MATERNITY LEAVE',
  PERSONAL_LEAVE: 'PERSONAL LEAVE',
  OTHER: 'LEAVE',
};

const laneFills: Record<string, string> = {
  SUPERVISOR: 'A9D8F7',
  PRICING_CLERK: 'BFF4B8',
  CASHIER: 'F5B5DF',
  PRODUCE_MEAT: 'C6A7F5',
  MERCHANDISER: 'F8E8B8',
};

const brand = {
  red: 'E31837',
  navy: '1B3A5C',
  green: '0B8F5A',
  border: '1A1A2E',
  white: 'FFFFFF',
};

type ScheduleExportInput = {
  schedule: any;
  staff: any[];
  absences: any[];
  weekStart: Date;
};

export async function buildScheduleWorkbook(input: ScheduleExportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SuperPlus Platform';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Schedule', {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
      horizontalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: 4 }],
  });

  sheet.properties.defaultRowHeight = 23;
  sheet.columns = [
    { key: 'lane', width: 15 },
    { key: 'name', width: 18 },
    ...DAY_NAMES.flatMap((_, index) => [
      { key: `day${index}Start`, width: 12 },
      { key: `day${index}End`, width: 12 },
    ]),
  ];

  addTitleRows(sheet, input.weekStart, input.schedule.store?.name ?? 'SuperPlus');
  addLogo(workbook, sheet);
  addDayHeader(sheet, input.weekStart);
  addStaffRows(sheet, input);
  applySheetBorders(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

function addTitleRows(sheet: ExcelJS.Worksheet, weekStart: Date, storeName: string) {
  sheet.mergeCells('A1:P1');
  const title = sheet.getCell('A1');
  title.value = 'SUPERPLUS WEEKLY STAFF SCHEDULE';
  title.font = { name: 'Arial', bold: true, size: 18, color: { argb: brand.white } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = solidFill(brand.red);

  sheet.mergeCells('A2:P2');
  const subtitle = sheet.getCell('A2');
  const weekEnd = addDays(weekStart, 6);
  subtitle.value = `${storeName.toUpperCase()} | ${formatDisplayDate(weekStart)} - ${formatDisplayDate(weekEnd)}`;
  subtitle.font = { name: 'Arial', bold: true, size: 12, color: { argb: brand.navy } };
  subtitle.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitle.fill = solidFill('FFF0EC');

  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 24;
}

function addLogo(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  if (!fs.existsSync(logoPath)) return;

  const imageId = workbook.addImage({
    filename: logoPath,
    extension: 'png',
  });
  sheet.addImage(imageId, {
    tl: { col: 0.1, row: 0.15 },
    ext: { width: 72, height: 28 },
  });
}

function addDayHeader(sheet: ExcelJS.Worksheet, weekStart: Date) {
  const dateRow = sheet.getRow(3);
  const dayRow = sheet.getRow(4);

  sheet.mergeCells(3, 1, 4, 1);
  sheet.mergeCells(3, 2, 4, 2);
  sheet.getCell(3, 1).value = 'ROLE';
  sheet.getCell(3, 2).value = 'NAME';

  for (let i = 0; i < 7; i++) {
    const startCol = 3 + i * 2;
    const endCol = startCol + 1;
    const date = addDays(weekStart, i);
    sheet.mergeCells(3, startCol, 3, endCol);
    sheet.mergeCells(4, startCol, 4, endCol);
    sheet.getCell(3, startCol).value = formatNumericDate(date);
    sheet.getCell(4, startCol).value = DAY_NAMES[date.getDay()];
  }

  for (const rowNumber of [3, 4]) {
    const row = sheet.getRow(rowNumber);
    row.height = 25;
    row.eachCell(cell => {
      cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: '111827' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = solidFill('F8F9FA');
    });
  }
}

function addStaffRows(sheet: ExcelJS.Worksheet, input: ScheduleExportInput) {
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(input.weekStart, index));
  const slotsByUserDate = new Map<string, any>();
  for (const slot of input.schedule.slots ?? []) {
    slotsByUserDate.set(`${slot.userId}:${formatDate(slot.date)}`, slot);
  }

  const absencesByUserDate = new Map<string, any>();
  for (const absence of input.absences) {
    for (const date of weekDates) {
      if (date >= startOfDay(absence.startDate) && date <= startOfDay(absence.endDate)) {
        absencesByUserDate.set(`${absence.userId}:${formatDate(date)}`, absence);
      }
    }
  }

  const slottedUserIds = new Set((input.schedule.slots ?? []).map((slot: any) => slot.userId));
  const staff = input.staff
    .filter(user => user.isActive || slottedUserIds.has(user.id))
    .sort((a, b) => {
      const laneDiff = laneIndex(a.jobLane) - laneIndex(b.jobLane);
      return laneDiff || a.fullName.localeCompare(b.fullName);
    });

  let rowNumber = 5;
  for (const user of staff) {
    const row = sheet.getRow(rowNumber);
    row.height = 30;
    const fillColor = laneFills[user.jobLane] ?? laneFills.CASHIER;

    row.getCell(1).value = laneLabels[user.jobLane] ?? user.jobLane;
    row.getCell(2).value = user.fullName.toUpperCase();
    row.getCell(1).font = { name: 'Arial', bold: false, size: 8, color: { argb: '111827' } };
    row.getCell(2).font = { name: 'Arial', bold: true, size: 10, color: { argb: '111827' } };

    for (const cellIndex of [1, 2]) {
      row.getCell(cellIndex).fill = solidFill(fillColor);
      row.getCell(cellIndex).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    for (let i = 0; i < 7; i++) {
      const date = weekDates[i];
      const dateKey = formatDate(date);
      const startCell = row.getCell(3 + i * 2);
      const endCell = row.getCell(4 + i * 2);
      const absence = absencesByUserDate.get(`${user.id}:${dateKey}`);
      const slot = slotsByUserDate.get(`${user.id}:${dateKey}`);

      startCell.fill = solidFill(fillColor);
      endCell.fill = solidFill(fillColor);
      startCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      endCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      if (absence) {
        startCell.value = absenceLabels[absence.type] ?? 'LEAVE';
        endCell.value = '';
        startCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: brand.navy } };
        endCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: brand.navy } };
        sheet.mergeCells(rowNumber, 3 + i * 2, rowNumber, 4 + i * 2);
      } else if (slot) {
        startCell.value = formatTime(slot.startTime);
        endCell.value = formatTime(slot.endTime);
        startCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: brand.green } };
        endCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: brand.red } };
      } else {
        startCell.value = 'OFF';
        endCell.value = 'OFF';
        startCell.font = { name: 'Arial', bold: false, size: 11, color: { argb: '111827' } };
        endCell.font = { name: 'Arial', bold: false, size: 11, color: { argb: '111827' } };
      }
    }

    rowNumber++;
  }
}

function applySheetBorders(sheet: ExcelJS.Worksheet) {
  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: brand.border } },
        left: { style: 'thin', color: { argb: brand.border } },
        bottom: { style: 'thin', color: { argb: brand.border } },
        right: { style: 'thin', color: { argb: brand.border } },
      };
    });
  });
}

function laneIndex(jobLane: string) {
  const index = laneOrder.indexOf(jobLane);
  return index === -1 ? laneOrder.length : index;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDate(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function formatNumericDate(date: Date) {
  const clean = startOfDay(date);
  return `${String(clean.getDate()).padStart(2, '0')}/${String(clean.getMonth() + 1).padStart(2, '0')}/${clean.getFullYear()}`;
}

function formatDisplayDate(date: Date) {
  return startOfDay(date).toLocaleDateString('en-JM', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addDays(date: Date, days: number) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const clean = new Date(date);
  clean.setHours(0, 0, 0, 0);
  return clean;
}

function solidFill(color: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}
