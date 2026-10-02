# Google Sheets ledger

The ledger is an ordinary Google Sheet that you own. You can open it, filter it, make pivot tables, or download it as Excel at any time. MyXPNS only reads it and appends to it.

## Creating or connecting

- **Create My Finance Sheet** creates `MyXPNS Ledger` inside the `MyXPNS` folder of your Drive, with every tab, header and default list below.
- **Connect an existing sheet** opens the Google Picker. MyXPNS then inspects the chosen sheet (read-only):
  - tabs that already exist must have the expected header row, otherwise MyXPNS refuses to connect and changes nothing;
  - missing tabs, or completely empty ones, are listed. Only after you confirm does MyXPNS add them with headers and defaults;
  - existing tabs with data are never rewritten, reformatted or deleted.

No spreadsheet ID is hard-coded anywhere. (In particular, the existing Veda Pathashala Finance DB is never touched unless someone deliberately picks it.)

## Tabs

### `Transactions`

| Col | Header | Stored as | Notes |
|---|---|---|---|
| A | Transaction ID | text | `TX-20261003-K7Q2M9` |
| B | Date | date (serial number, formatted `yyyy-mm-dd`) | Calendar date, no time zone |
| C | Type | `RECEIVED` or `SPENT` | |
| D | Amount | number, always positive | Two decimals at most |
| E | Category | text | Must match the `Categories` tab when entered via the app |
| F | Merchant / Person | text | Canonical name after normalization |
| G | Payment Method | text | |
| H | Receipt URL | text | Google Drive link, or blank |
| I | Notes | text | |
| J | Created At | ISO 8601 text | |
| K | Created By | email | |

Values are written with `valueInputOption=RAW`, so nothing you type in the app is ever interpreted as a formula.

**Editing by hand is fine.** To fix or delete a transaction, edit or delete the row in Google Sheets, then tap **Settings → Refresh from sheet**. When reading, MyXPNS accepts dates as real dates, `YYYY-MM-DD` or `DD/MM/YYYY`; types in any letter case; and amounts with commas. A row missing an ID, a valid date, a type or a positive amount is skipped, and the app tells you how many rows it skipped. A blank category is shown as `Uncategorized`.

### `Categories`

| Name | Type | Active |
|---|---|---|
| Groceries | SPENT | TRUE |
| Salary | RECEIVED | TRUE |
| Donations | BOTH | TRUE |

`Type` is `SPENT`, `RECEIVED` or `BOTH` (blank means `BOTH`). Set `Active` to `FALSE` to hide a category without losing history. Rows are shown in sheet order (the app also floats your most-used categories to the front).

Defaults: Groceries, Dining, Transportation, Fuel, Personal Care, Healthcare, Education, Utilities, Rent (both), Shopping, Entertainment, Travel, Subscriptions, Household, Donations (both), Salary, Other Income, Other Expense.

**Example: a Veda Pathashala ledger.** Add rows such as `Milk | SPENT`, `Vegetables | SPENT`, `Maid | SPENT`, `Electricity | SPENT`, and set `Donations` to `BOTH` or `RECEIVED`. No code changes are needed.

### `Merchant_Rules`

| Merchant | Aliases | Category |
|---|---|---|
| DMart | Avenue Supermarts | Groceries |

- Matching ignores case, spaces and punctuation: `DMart`, `D-Mart` and `D MART` all match `DMart` automatically.
- `Aliases` (separated by commas or semicolons) catch genuinely different spellings.
- `Category` can be blank, in which case the rule only normalizes the name.
- If two rules match, the one further down wins.
- The app adds or updates a row here when you tick **"Always categorize X as Y"**.

### `Payment_Methods`

| Name | Active |
|---|---|
| UPI | TRUE |

Defaults: UPI, Cash, Credit Card, Debit Card, Bank Transfer, Other.

### `Settings`

Key/value pairs: `Schema Version`, `Ledger Name` (shown in the app), `Currency` (3-letter ISO code, default `INR`), `Created At`.

## API usage

| Action | Call |
|---|---|
| Load everything | 1 × `spreadsheets.values.batchGet` (`UNFORMATTED_VALUE`, `SERIAL_NUMBER`) |
| Add transaction | 1 × `values.append` (RAW, INSERT_ROWS) |
| Retry after unknown outcome | `values.get Transactions!A2:A` (duplicate check), then append if needed |
| Save merchant rule | `values.get Merchant_Rules!A2:C`, then `values.update` of one cell or `values.append` |
| Create ledger | `spreadsheets.create` + 1 × `batchUpdate` (column formats) |

Everything is well within the default Sheets API quota for personal use.

## Sharing

Use **Share** in Google Sheets and give the other person **Editor** access. They sign in to MyXPNS with their own Google account and choose **Connect an existing sheet**. Each transaction records who added it in **Created By**.
