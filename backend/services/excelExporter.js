const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Convert 24-hour time to 12-hour format
 */
function formatTime12Hour(time24) {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Generate Excel file with lineup data
 */
async function generateExcelLineup(lineups, filename = 'lineup.xlsx') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Shift Lineup App';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Lineup');

  // Set up columns
  worksheet.columns = [
    { header: 'Time Period', key: 'timePeriod', width: 20 },
    { header: 'Shift', key: 'shift', width: 12 },
    { header: 'Position', key: 'position', width: 20 },
    { header: 'Employee', key: 'employee', width: 20 },
    { header: 'Match', key: 'match', width: 12 },
    { header: 'Break Status', key: 'breakStatus', width: 15 }
  ];

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE31837' } // Chick-fil-A red
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  let currentRow = 2;

  for (const lineup of lineups) {
    const timePeriod = `${formatTime12Hour(lineup.startTime)} - ${formatTime12Hour(lineup.endTime)}`;
    let firstRowOfPeriod = currentRow;

    for (const assignment of lineup.assignments) {
      let breakStatus = '';
      if (assignment.needsBreak) {
        breakStatus = assignment.breakType === 'required' ? 'BREAK REQUIRED' : 'Break (optional)';
      }

      worksheet.addRow({
        timePeriod: currentRow === firstRowOfPeriod ? timePeriod : '',
        shift: currentRow === firstRowOfPeriod ? lineup.shiftPeriod : '',
        position: assignment.position,
        employee: assignment.employee.name,
        match: assignment.matchQuality,
        breakStatus: breakStatus
      });

      // Color code match quality
      const matchCell = worksheet.getCell(`E${currentRow}`);
      if (assignment.matchQuality === 'best') {
        matchCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF90EE90' } // Light green
        };
      } else if (assignment.matchQuality === 'fallback') {
        matchCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCB' } // Light red
        };
      }

      // Highlight required breaks
      if (assignment.breakType === 'required') {
        const breakCell = worksheet.getCell(`F${currentRow}`);
        breakCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' } // Yellow
        };
        breakCell.font = { bold: true };
      }

      currentRow++;
    }

    // Add a separator row between time periods
    worksheet.addRow({});
    currentRow++;
  }

  // Add summary section
  worksheet.addRow({});
  currentRow++;

  const summaryRow = worksheet.addRow({
    timePeriod: 'SUMMARY',
    shift: '',
    position: '',
    employee: '',
    match: '',
    breakStatus: ''
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFCCCCCC' }
  };

  worksheet.addRow({
    timePeriod: `Total Time Periods: ${lineups.length}`,
    shift: '',
    position: '',
    employee: '',
    match: '',
    breakStatus: ''
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  return workbook;
}

/**
 * Export workbook to buffer
 */
async function exportToBuffer(lineups) {
  const workbook = await generateExcelLineup(lineups);
  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  generateExcelLineup,
  exportToBuffer
};
