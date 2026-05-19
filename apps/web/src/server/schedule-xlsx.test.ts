import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildScheduleWorkbook } from './schedule-xlsx';

async function main() {
  const weekStart = new Date(2026, 4, 17);
  const supervisor = { id: 'u1', fullName: 'Aleer', role: 'SUPERVISOR', jobLane: 'SUPERVISOR', isActive: true };
  const cashier = { id: 'u2', fullName: 'Antonette', role: 'STAFF', jobLane: 'CASHIER', isActive: true };
  const workbookBuffer = await buildScheduleWorkbook({
    weekStart,
    staff: [cashier, supervisor],
    absences: [{
      id: 'a1',
      storeId: 's1',
      userId: cashier.id,
      startDate: weekStart,
      endDate: weekStart,
      type: 'SICK_LEAVE',
      note: null,
      user: { fullName: cashier.fullName },
    }],
    schedule: {
      store: { name: 'SuperPlus Mandeville' },
      slots: [{
        id: 'slot1',
        userId: supervisor.id,
        date: weekStart,
        startTime: '06:00',
        endTime: '21:00',
        user: supervisor,
      }],
    },
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer as any);
  const sheet = workbook.getWorksheet('Schedule');
  assert(sheet);
  assert.equal(sheet.getCell('A1').value, 'SUPERPLUS WEEKLY STAFF SCHEDULE');
  assert.equal(sheet.getCell('C3').value, '17/05/2026');
  assert.equal(sheet.getCell('C4').value, 'SUNDAY');
  assert.equal(sheet.getCell('A5').value, 'SUPERVISOR');
  assert.equal(sheet.getCell('B5').value, 'ALEER');
  assert.equal(sheet.getCell('C5').value, '6:00 am');
  assert.equal(sheet.getCell('D5').value, '9:00 pm');
  assert.equal(sheet.getCell('A6').value, 'CASHIER');
  assert.equal(sheet.getCell('C6').value, 'SICK LEAVE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
