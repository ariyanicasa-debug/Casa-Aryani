function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const values = sheet.getDataRange().getValues();
  const callback = e && e.parameter && e.parameter.callback;

  if (values.length < 2) {
    return output([], callback);
  }

  const headers = values[0].map(h => String(h).toLowerCase().trim());

  const nameIndex = findColumn(headers, ['full name', 'name', 'guest name']);
  const packageIndex = findColumn(headers, ['package', 'chosen package', 'booking package']);
  const startIndex = findColumn(headers, ['check-in', 'check in', 'start date', 'booking date', 'preferred date', 'date']);
  const endIndex = findColumn(headers, ['check-out', 'check out', 'end date']);
  const statusIndex = findColumn(headers, ['status', 'booking status', 'confirmation status']);

  const bookings = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const startRaw = startIndex >= 0 ? row[startIndex] : '';
    const endRaw = endIndex >= 0 ? row[endIndex] : startRaw;
    const status = statusIndex >= 0 ? String(row[statusIndex]).toLowerCase().trim() : 'confirmed';

    // If a Status column exists, only these statuses will block dates.
    // If there is no Status column, every submitted response will block dates.
    if (statusIndex >= 0 && !['confirmed', 'booked', 'paid', 'approved'].includes(status)) {
      continue;
    }

    const start = toISODate(startRaw);
    let end = toISODate(endRaw);

    if (!start) continue;

    // If one date only, block one day.
    if (!end || end === start) {
      const next = new Date(start + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      end = Utilities.formatDate(next, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }

    bookings.push({
      start: start,
      end: end,
      name: nameIndex >= 0 ? String(row[nameIndex]) : 'Booked',
      package: packageIndex >= 0 ? String(row[packageIndex]) : ''
    });
  }

  return output(bookings, callback);
}

function findColumn(headers, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.includes(name));
    if (index >= 0) return index;
  }
  return -1;
}

function toISODate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return '';
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function output(data, callback) {
  const json = JSON.stringify(data);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
