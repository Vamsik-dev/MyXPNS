import { addDays, isValidIsoDate, isoDateToSerial, monthLabel, serialToIsoDate, shiftMonth, shortDateLabel } from './dates';
import { newTransactionId } from './ids';
import { formatMoney, parseAmount } from './money';
import { checkReceiptFile, receiptFileName, receiptFolderPath } from './receipts';

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
  });
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthLabel('2026-10')).toBe('October 2026');
  });
  it('round-trips Google Sheets serial dates', () => {
    expect(isoDateToSerial('1899-12-31')).toBe(1);
    expect(serialToIsoDate(isoDateToSerial('2026-10-03'))).toBe('2026-10-03');
    expect(serialToIsoDate(46298.75)).toBe(serialToIsoDate(46298));
  });
  it('labels today / yesterday', () => {
    expect(shortDateLabel('2026-10-15', '2026-10-15')).toBe('Today');
    expect(shortDateLabel(addDays('2026-10-01', -1), '2026-10-01')).toBe('Yesterday');
  });
});

describe('money', () => {
  it('formats rupees Indian-style', () => {
    expect(formatMoney(250000)).toBe('₹2,50,000');
    expect(formatMoney(1250.5)).toBe('₹1,250.5');
    expect(formatMoney(-500)).toBe('−₹500');
    expect(formatMoney(500, 'INR', { signed: true })).toBe('+₹500');
  });
  it('parses typed amounts', () => {
    expect(parseAmount('₹1,250')).toBe(1250);
    expect(parseAmount('Rs. 99.5')).toBe(99.5);
    expect(parseAmount('1e5')).toBeNaN();
    expect(parseAmount('12abc')).toBeNaN();
  });
});

describe('ids', () => {
  it('builds deterministic ids from a random source', () => {
    expect(newTransactionId('2026-10-03', (n) => new Uint8Array(n))).toBe('TX-20261003-222222');
    expect(newTransactionId('2026-10-03')).toMatch(/^TX-20261003-[2-9A-Z]{6}$/);
  });
});

describe('receipts', () => {
  it('organizes by year/month', () => {
    expect(receiptFolderPath('2026-10-03')).toEqual(['MyXPNS', 'Receipts', '2026', '10-October']);
  });
  it('builds safe file names', () => {
    expect(receiptFileName({ date: '2026-10-03', merchant: 'DMart', amount: 1250, mimeType: 'image/jpeg' })).toBe('2026-10-03_DMart_1250.jpg');
    expect(receiptFileName({ date: '2026-10-03', merchant: '../Café / Bar', amount: 99.5, mimeType: 'application/pdf' })).toBe('2026-10-03_CafeBar_99.50.pdf');
    expect(receiptFileName({ date: '2026-10-03', merchant: '', amount: 1, mimeType: 'image/png' })).toBe('2026-10-03_Receipt_1.png');
  });
  it('checks type and size', () => {
    expect(checkReceiptFile({ type: 'image/jpeg', size: 1000 })).toBeUndefined();
    expect(checkReceiptFile({ type: 'text/html', size: 1000 })).toMatch(/photo/);
    expect(checkReceiptFile({ type: 'image/jpeg', size: 16 * 1024 * 1024 })).toMatch(/too large/);
    expect(checkReceiptFile({ type: 'image/jpeg', size: 0 })).toMatch(/empty/);
  });
});
