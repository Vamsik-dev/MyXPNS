import { buildMerchantIndex } from '../domain/merchants';
import { memoryStore } from '../lib/storage';
import { categories, fixtureTransactions, merchantRules, paymentMethods, TODAY } from '../test/fixtures';
import { DemoLedgerRepository } from './demo/repository';
import { AppError } from './errors';
import type { LedgerRepository } from './repository';
import type { SaveRequest } from './saveTransaction';
import { saveTransaction } from './saveTransaction';

const NOW = new Date('2026-10-15T09:30:00.000Z');

function request(repo: LedgerRepository, overrides: Partial<SaveRequest> = {}): SaveRequest {
  return {
    repo,
    input: { type: 'SPENT', amount: '1250', date: TODAY, category: 'Groceries', merchant: 'd-mart', paymentMethod: 'UPI', notes: '' },
    ledger: { categories, paymentMethods, history: fixtureTransactions() },
    merchantIndex: buildMerchantIndex(merchantRules),
    createdBy: 'me@example.com',
    now: NOW,
    today: TODAY,
    ...overrides,
  };
}

const photo = () => ({ file: new Blob(['jpeg-bytes']), mimeType: 'image/jpeg' });

describe('saveTransaction', () => {
  it('saves an expense with a normalized merchant', async () => {
    const repo = new DemoLedgerRepository({ store: memoryStore(), today: TODAY });
    const r = await saveTransaction(request(repo));
    expect(r.status).toBe('saved');
    if (r.status !== 'saved') return;
    expect(r.transaction).toMatchObject({ type: 'SPENT', amount: 1250, merchant: 'DMart', category: 'Groceries', createdBy: 'me@example.com', createdAt: NOW.toISOString(), receiptUrl: '' });
    expect(r.transaction.id).toMatch(/^TX-20261015-/);
    expect(await repo.hasTransaction(r.transaction.id)).toBe(true);
  });

  it('saves a received transaction', async () => {
    const repo = new DemoLedgerRepository({ store: memoryStore(), today: TODAY });
    const r = await saveTransaction(
      request(repo, { input: { type: 'RECEIVED', amount: '250000', date: TODAY, category: 'Salary', merchant: 'Employer', paymentMethod: 'Bank Transfer' } }),
    );
    expect(r.status === 'saved' && r.transaction).toMatchObject({ type: 'RECEIVED', amount: 250000, category: 'Salary', merchant: 'Employer' });
  });

  it('returns field errors and writes nothing for invalid input', async () => {
    const repo = { ...stubRepo(), appendTransaction: vi.fn() };
    const r = await saveTransaction(request(repo, { input: { ...request(repo).input, amount: '0' } }));
    expect(r.status).toBe('invalid');
    expect(repo.appendTransaction).not.toHaveBeenCalled();
  });

  it('uploads the receipt first and stores its URL', async () => {
    const repo = stubRepo();
    const r = await saveTransaction(request(repo, { receipt: photo() }));
    expect(repo.uploadReceipt).toHaveBeenCalledWith(expect.any(Blob), { fileName: '2026-10-15_DMart_1250.jpg', date: TODAY, mimeType: 'image/jpeg' });
    expect(r.status === 'saved' && r.transaction.receiptUrl).toBe('https://drive.google.com/file/d/r1/view');
  });

  it('receipt upload failure: nothing is saved, the user can retry or save without it', async () => {
    const repo = stubRepo();
    repo.uploadReceipt.mockRejectedValueOnce(new AppError('network', 'offline'));
    const first = await saveTransaction(request(repo, { receipt: photo() }));
    expect(first.status).toBe('receipt_failed');
    expect(repo.appendTransaction).not.toHaveBeenCalled();
    if (first.status !== 'receipt_failed') return;
    expect(first.error.kind).toBe('network');

    // Option A: retry with the receipt — same ID is reused.
    const retry = await saveTransaction(request(repo, { receipt: photo(), previous: first.attempt }));
    expect(retry.status === 'saved' && retry.transaction.id).toBe(first.attempt.id);

    // Option B: save without the receipt.
    const repo2 = stubRepo();
    repo2.uploadReceipt.mockRejectedValueOnce(new AppError('server', 'x'));
    const failed = await saveTransaction(request(repo2, { receipt: photo() }));
    if (failed.status !== 'receipt_failed') throw new Error('expected failure');
    const without = await saveTransaction(request(repo2, { previous: failed.attempt }));
    expect(without.status === 'saved' && without.transaction.receiptUrl).toBe('');
    expect(repo2.uploadReceipt).toHaveBeenCalledTimes(1);
  });

  it('ledger write failure keeps the uploaded receipt so a retry does not upload it twice', async () => {
    const repo = stubRepo();
    repo.appendTransaction.mockRejectedValueOnce(new AppError('rate_limited', 'busy'));
    const first = await saveTransaction(request(repo, { receipt: photo() }));
    expect(first.status).toBe('save_failed');
    if (first.status !== 'save_failed') return;
    expect(first.attempt.uploadedReceipt?.fileId).toBe('r1');
    expect(first.attempt.outcomeUnknown).toBe(false);

    const retry = await saveTransaction(request(repo, { receipt: photo(), previous: first.attempt }));
    expect(retry.status).toBe('saved');
    expect(repo.uploadReceipt).toHaveBeenCalledTimes(1);
    expect(repo.hasTransaction).not.toHaveBeenCalled();
  });

  it('after a network failure on write, the retry checks for the row first to avoid duplicates', async () => {
    const repo = stubRepo();
    repo.appendTransaction.mockRejectedValueOnce(new AppError('network', 'timeout'));
    const first = await saveTransaction(request(repo));
    if (first.status !== 'save_failed') throw new Error('expected failure');
    expect(first.attempt.outcomeUnknown).toBe(true);

    repo.hasTransaction.mockResolvedValueOnce(true); // the first write actually reached Google
    const retry = await saveTransaction(request(repo, { previous: first.attempt }));
    expect(retry.status).toBe('saved');
    expect(repo.hasTransaction).toHaveBeenCalledWith(first.attempt.id);
    expect(repo.appendTransaction).toHaveBeenCalledTimes(1);
  });

  it('remembers a merchant rule when asked', async () => {
    const repo = new DemoLedgerRepository({ store: memoryStore(), today: TODAY });
    const r = await saveTransaction(request(repo, { input: { ...request(repo).input, merchant: 'Raju Barber', category: 'Personal Care' }, rememberRule: true }));
    expect(r.status === 'saved' && r.rules?.at(-1)).toEqual({ merchant: 'Raju Barber', aliases: [], category: 'Personal Care' });
  });

  it('a failing rule save does not lose the transaction', async () => {
    const repo = stubRepo();
    repo.saveMerchantRule.mockRejectedValueOnce(new AppError('forbidden', 'no'));
    const r = await saveTransaction(request(repo, { rememberRule: true }));
    expect(r.status).toBe('saved');
    expect(r.status === 'saved' && r.ruleError?.kind).toBe('forbidden');
    expect(repo.appendTransaction).toHaveBeenCalledTimes(1);
  });
});

function stubRepo() {
  return {
    kind: 'google' as const,
    load: vi.fn(),
    appendTransaction: vi.fn().mockResolvedValue(undefined),
    hasTransaction: vi.fn().mockResolvedValue(false),
    saveMerchantRule: vi.fn().mockResolvedValue([]),
    uploadReceipt: vi.fn().mockResolvedValue({ fileId: 'r1', url: 'https://drive.google.com/file/d/r1/view' }),
  };
}
