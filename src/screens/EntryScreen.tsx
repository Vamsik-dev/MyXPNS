import { useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppState';
import { navigate } from '../app/router';
import { saveTransaction } from '../data/saveTransaction';
import type { SaveRequest } from '../data/saveTransaction';
import { userMessage } from '../data/errors';
import { todayIso } from '../domain/dates';
import { buildMerchantIndex, knownMerchants, shouldOfferRule, suggestCategory } from '../domain/merchants';
import { formatMoney } from '../domain/money';
import { checkReceiptFile } from '../domain/receipts';
import type { Transaction, TransactionType } from '../domain/types';
import type { FieldErrors } from '../domain/validation';
import { categoriesFor } from '../domain/validation';
import { prepareReceipt } from '../lib/image';
import { browserStore, prefs } from '../lib/storage';
import { useOnline } from '../lib/useOnline';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Chips } from '../ui/Chips';
import { Icon } from '../ui/Icon';

type Failure = { kind: 'receipt' | 'save'; message: string };

export function EntryScreen({ type }: { type: TransactionType }) {
  const app = useApp();
  const ledger = app.data!;
  const online = useOnline();
  const isSpent = type === 'SPENT';

  const categoryOptions = useMemo(() => {
    // Most-used categories first, so the usual choice is under your thumb.
    const usage = new Map<string, number>();
    for (const t of ledger.transactions) if (t.type === type) usage.set(t.category, (usage.get(t.category) ?? 0) + 1);
    return categoriesFor(type, ledger.categories)
      .map((c, i) => ({ name: c.name, i, n: usage.get(c.name) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((c) => c.name);
  }, [ledger.categories, ledger.transactions, type]);
  const paymentOptions = ledger.paymentMethods.filter((p) => p.active).map((p) => p.name);
  const index = useMemo(() => buildMerchantIndex(ledger.merchantRules), [ledger.merchantRules]);
  const merchantSuggestions = useMemo(() => knownMerchants(ledger.transactions, ledger.merchantRules, type).slice(0, 200), [ledger, type]);

  const lastPayment = prefs.lastPayment(browserStore, type);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [categorySource, setCategorySource] = useState<'rule' | 'history' | 'manual' | ''>('');
  const [payment, setPayment] = useState(lastPayment && paymentOptions.includes(lastPayment) ? lastPayment : (paymentOptions[0] ?? ''));
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [rememberRule, setRememberRule] = useState(false);
  const [errors, setErrors] = useState<FieldErrors & { receipt?: string }>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saved, setSaved] = useState<{ tx: Transaction; ruleFailed: boolean } | null>(null);
  const attempt = useRef<SaveRequest['previous']>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const onMerchantChange = (value: string) => {
    setMerchant(value);
    if (categorySource === 'manual') return;
    const s = suggestCategory(value, type, index, ledger.transactions, categoryOptions);
    setCategory(s?.category ?? '');
    setCategorySource(s?.source ?? '');
  };

  const onCategoryChange = (value: string) => {
    setCategory(value);
    setCategorySource('manual');
  };

  const offerRule = categorySource === 'manual' && shouldOfferRule(merchant, category, index);

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const problem = checkReceiptFile(file);
    setErrors((e) => ({ ...e, receipt: problem }));
    if (!problem) {
      setReceipt(file);
      attempt.current = attempt.current ? { ...attempt.current, uploadedReceipt: undefined } : undefined;
    }
  };

  const reset = () => {
    setAmount('');
    setMerchant('');
    setCategory('');
    setCategorySource('');
    setNotes('');
    setReceipt(null);
    setRememberRule(false);
    setErrors({});
    setFailure(null);
    setSaved(null);
    attempt.current = undefined;
  };

  async function submit(opts: { withoutReceipt?: boolean } = {}) {
    if (saving || !app.repo) return;
    setSaving(true);
    setFailure(null);
    const useReceipt = opts.withoutReceipt ? null : receipt;
    if (opts.withoutReceipt) setReceipt(null);
    try {
      const prepared = useReceipt ? await prepareReceipt(useReceipt) : undefined;
      const result = await saveTransaction({
        repo: app.repo,
        input: { type, amount, date, category, merchant, paymentMethod: payment, notes },
        ledger: { categories: ledger.categories, paymentMethods: ledger.paymentMethods, history: ledger.transactions },
        merchantIndex: index,
        createdBy: app.email ?? '',
        receipt: prepared ? { file: prepared.blob, mimeType: prepared.mimeType } : undefined,
        rememberRule: offerRule && rememberRule,
        previous: attempt.current,
      });
      if (result.status === 'invalid') {
        setErrors(result.errors);
      } else if (result.status === 'receipt_failed') {
        attempt.current = result.attempt;
        setFailure({ kind: 'receipt', message: userMessage(result.error) });
      } else if (result.status === 'save_failed') {
        attempt.current = result.attempt;
        setFailure({ kind: 'save', message: userMessage(result.error) });
      } else {
        prefs.setLastPayment(browserStore, type, payment);
        app.applySaved(result.transaction, result.rules);
        setSaved({ tx: result.transaction, ruleFailed: !!result.ruleError });
        attempt.current = undefined;
      }
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center" role="status">
        <div className="grid size-16 place-items-center rounded-full bg-positive text-white">
          <Icon name="check" className="size-9" strokeWidth={2.6} />
        </div>
        <p className="mt-4 text-[22px] font-semibold">Saved ✓</p>
        <p className={`num mt-6 text-[40px] font-bold ${saved.tx.type === 'RECEIVED' ? 'text-positive' : ''}`}>{formatMoney(saved.tx.amount, ledger.settings.currency)}</p>
        {saved.tx.merchant && <p className="text-[19px]">{saved.tx.merchant}</p>}
        <p className="text-[17px] text-muted">{saved.tx.category}</p>
        {saved.ruleFailed && <p className="mt-4 text-[14px] text-negative">Saved, but the merchant rule couldn’t be stored. You can try again next time.</p>}
        <div className="mt-10 flex w-full flex-col gap-3">
          <Button onClick={reset}>Add Another</Button>
          <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="pb-24"
    >
      <header className="flex items-center justify-between pb-2 pt-4">
        <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : navigate({ name: 'home' })} className="min-h-11 pr-4 text-[17px] text-accent">
          Cancel
        </button>
        <h1 className="text-[17px] font-semibold">{isSpent ? 'Money Spent' : 'Money Received'}</h1>
        <span className="w-16" />
      </header>

      <label className="mt-4 block rounded-3xl bg-surface px-5 py-4">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">Amount</span>
        <div className="flex items-baseline gap-2">
          <span className="text-[34px] font-semibold text-muted">₹</span>
          <input
            autoFocus
            inputMode="decimal"
            enterKeyHint="next"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            className={`num w-full bg-transparent text-[40px] font-bold outline-none placeholder:text-surface-2 ${isSpent ? '' : 'text-positive'}`}
            style={{ fontSize: 40 }}
          />
        </div>
        {errors.amount && <span className="text-[14px] text-negative">{errors.amount}</span>}
      </label>

      <div className="mt-3 overflow-hidden rounded-3xl bg-surface">
        <label className="flex min-h-14 items-center gap-3 border-b border-line px-5">
          <span className="w-28 shrink-0 text-muted">{isSpent ? 'Merchant' : 'Received from'}</span>
          <input
            list="merchant-suggestions"
            value={merchant}
            onChange={(e) => onMerchantChange(e.target.value)}
            placeholder={isSpent ? 'e.g. DMart' : 'e.g. Employer, Donor'}
            autoComplete="off"
            autoCapitalize="words"
            maxLength={100}
            className="min-w-0 flex-1 bg-transparent py-3 outline-none"
          />
        </label>
        <datalist id="merchant-suggestions">
          {merchantSuggestions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <label className="flex min-h-14 items-center gap-3 px-5">
          <span className="w-28 shrink-0 text-muted">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
        </label>
        {errors.merchant && <p className="px-5 pb-3 text-[14px] text-negative">{errors.merchant}</p>}
        {errors.date && <p className="px-5 pb-3 text-[14px] text-negative">{errors.date}</p>}
      </div>

      <div className="mt-6">
        <Chips label={isSpent ? 'Category' : 'Category / Purpose'} options={categoryOptions} value={category} onChange={onCategoryChange} error={errors.category} />
        {category && (categorySource === 'rule' || categorySource === 'history') && (
          <p className="mt-2 px-1 text-[13px] text-muted">Picked automatically from {categorySource === 'rule' ? 'your merchant rules' : 'your last entry'}.</p>
        )}
        {offerRule && (
          <label className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl bg-surface px-4">
            <input type="checkbox" checked={rememberRule} onChange={(e) => setRememberRule(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            <span className="text-[15px]">
              Always categorize <strong>{merchant.trim()}</strong> as <strong>{category}</strong>
            </span>
          </label>
        )}
      </div>

      <div className="mt-6">
        <Chips label="Payment" options={paymentOptions} value={payment} onChange={setPayment} error={errors.paymentMethod} />
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl bg-surface">
        <div className="flex min-h-14 items-center gap-3 border-b border-line px-5">
          <span className="w-28 shrink-0 text-muted">Receipt</span>
          {receipt ? (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate">{receipt.name || 'Photo'}</span>
              <button type="button" className="text-negative" onClick={() => setReceipt(null)}>
                Remove
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-12 flex-1 items-center gap-2 text-accent">
              <Icon name="camera" className="size-5" /> Add photo or PDF
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              onPickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <label className="flex min-h-14 items-center gap-3 px-5">
          <span className="w-28 shrink-0 text-muted">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" maxLength={500} className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
        </label>
      </div>
      {errors.receipt && <p className="mt-2 px-1 text-[14px] text-negative">{errors.receipt}</p>}
      {errors.notes && <p className="mt-2 px-1 text-[14px] text-negative">{errors.notes}</p>}

      {failure && (
        <div className="mt-5">
          <Banner tone="error">
            <p className="font-semibold">{failure.kind === 'receipt' ? 'The receipt couldn’t be uploaded. Nothing was saved yet.' : 'The transaction wasn’t saved.'}</p>
            <p className="mt-1 text-ink">{failure.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="min-h-10 px-4 text-[15px]" disabled={saving || !online} onClick={() => void submit()}>
                Try again
              </Button>
              {failure.kind === 'receipt' && (
                <Button variant="secondary" className="min-h-10 px-4 text-[15px]" disabled={saving || !online} onClick={() => void submit({ withoutReceipt: true })}>
                  Save without receipt
                </Button>
              )}
            </div>
          </Banner>
        </div>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 bg-bg/90 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          {!online && <p className="mb-2 text-center text-[14px] text-muted">You’re offline — saving will work when you’re back online.</p>}
          <Button type="submit" className="w-full" disabled={saving || !online}>
            {saving ? (receipt ? 'Uploading receipt…' : 'Saving…') : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
}
