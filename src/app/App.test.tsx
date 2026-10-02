import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { memoryStore } from '../lib/storage';
import { App } from './App';
import { AppStateProvider } from './AppState';
import type { DemoOptions } from '../data/demo/repository';

function setup(demoOptions?: Omit<DemoOptions, 'store'>) {
  window.history.replaceState(null, '', '/#/home');
  // applyAccept: false lets tests bypass the file picker's own filter to exercise our validation.
  const user = userEvent.setup({ applyAccept: false });
  render(
    <AppStateProvider store={memoryStore()} demoOptions={demoOptions}>
      <App />
    </AppStateProvider>,
  );
  return user;
}

async function enterDemo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Try the demo' }));
  await screen.findByText(/Demo mode/);
}

function summaryValue(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling!.textContent;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T10:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('MyXPNS in demo mode', () => {
  it('shows the welcome screen, then a clearly marked demo dashboard', async () => {
    const user = setup();
    expect(screen.getByRole('heading', { name: 'MyXPNS' })).toBeInTheDocument();
    await enterDemo(user);
    expect(screen.getByText(/Nothing is sent to Google/)).toBeInTheDocument();
    expect(screen.getByText(/This Month · October 2026/)).toBeInTheDocument();
    expect(summaryValue('Money Received')).toBe('₹2,50,000');
    expect(summaryValue('Money Spent')).toBe('₹3,630');
    expect(summaryValue('Net')).toBe('+₹2,46,370');
    expect(screen.getByText('Apollo Pharmacy')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('records money spent with automatic merchant categorization', async () => {
    const user = setup();
    await enterDemo(user);
    await user.click(screen.getByRole('link', { name: /Money Spent/ }));
    expect(await screen.findByRole('heading', { name: 'Money Spent' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('0'), '1250');
    await user.type(screen.getByPlaceholderText('e.g. DMart'), 'd mart');
    const categories = screen.getByRole('radiogroup', { name: 'Category' });
    expect(within(categories).getByRole('radio', { name: 'Groceries' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Picked automatically from your merchant rules/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    expect(screen.getByText('₹1,250')).toBeInTheDocument();
    expect(screen.getByText('DMart')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText(/This Month/)).toBeInTheDocument();
    expect(summaryValue('Money Spent')).toBe('₹4,880');
  });

  it('records money received and supports Add Another', async () => {
    const user = setup();
    await enterDemo(user);
    await user.click(screen.getByRole('link', { name: /Money Received/ }));
    await user.type(await screen.findByPlaceholderText('0'), '5001');
    await user.type(screen.getByPlaceholderText(/Employer, Donor/), 'Sharma family');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Category / Purpose' })).getByRole('radio', { name: 'Donations' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Another' }));
    expect(screen.getByPlaceholderText('0')).toHaveValue('');
  });

  it('shows validation errors instead of saving', async () => {
    const user = setup();
    await enterDemo(user);
    await user.click(screen.getByRole('link', { name: /Money Spent/ }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter an amount.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
  });

  it('offers “Always categorize” when the user picks a category manually, and applies it next time', async () => {
    const user = setup();
    await enterDemo(user);
    await user.click(screen.getByRole('link', { name: /Money Spent/ }));
    await user.type(await screen.findByPlaceholderText('0'), '300');
    await user.type(screen.getByPlaceholderText('e.g. DMart'), 'Raju Barber');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Category' })).getByRole('radio', { name: 'Personal Care' }));
    await user.click(screen.getByRole('checkbox', { name: /Always categorize Raju Barber as Personal Care/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved ✓');

    await user.click(screen.getByRole('button', { name: 'Add Another' }));
    await user.type(screen.getByPlaceholderText('e.g. DMart'), 'raju barber');
    expect(within(screen.getByRole('radiogroup', { name: 'Category' })).getByRole('radio', { name: 'Personal Care' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/from your merchant rules/)).toBeInTheDocument();
  });

  it('receipt upload failure keeps the form and lets the user save without the receipt', async () => {
    const user = setup({ failReceiptUploads: true });
    await enterDemo(user);
    await user.click(screen.getByRole('link', { name: /Money Spent/ }));
    await user.type(await screen.findByPlaceholderText('0'), '780');
    await user.type(screen.getByPlaceholderText('e.g. DMart'), 'Apollo Pharmacy');
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    await user.upload(input, new File(['jpeg'], 'bill.jpg', { type: 'image/jpeg' }));
    expect(screen.getByText('bill.jpg')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/receipt couldn’t be uploaded. Nothing was saved yet/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0')).toHaveValue('780');

    await user.click(screen.getByRole('button', { name: 'Save without receipt' }));
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('rejects unsupported receipt files', async () => {
    const user = setup();
    await enterDemo(user);
    await user.click(screen.getByRole('link', { name: /Money Spent/ }));
    await screen.findByRole('heading', { name: 'Money Spent' });
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    await user.upload(input, new File(['<html>'], 'x.html', { type: 'text/html' }));
    expect(screen.getByText(/Receipts must be a photo/)).toBeInTheDocument();
  });

  it('transactions, reports and settings screens render from the ledger', async () => {
    const user = setup();
    await enterDemo(user);
    await user.click(screen.getByRole('link', { name: 'Transactions' }));
    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search transactions' }), 'barber');
    expect(screen.getByText('Barber')).toBeInTheDocument();
    expect(screen.queryByText('DMart')).not.toBeInTheDocument();

    await user.click(screen.getByText('Barber'));
    expect(screen.getByRole('dialog', { name: 'Money Spent' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('link', { name: 'Reports' }));
    expect(await screen.findByText('Spending by Category')).toBeInTheDocument();
    expect(screen.getByText(/vs last month/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(await screen.findByText('Sharing with family')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Leave demo' }));
    expect(screen.getByRole('button', { name: 'Try the demo' })).toBeInTheDocument();
  });
});
