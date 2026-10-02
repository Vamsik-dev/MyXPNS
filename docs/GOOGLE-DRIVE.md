# Google Drive receipts

Receipts are optional. When you attach a photo or PDF while adding a transaction:

1. Photos (JPEG, PNG, WebP) are resized in the browser to at most 1600 px on the long edge (JPEG, quality 0.82) when that makes them smaller, so uploads stay fast on mobile data. HEIC and PDF files are uploaded unchanged. The maximum size is 15 MB.
2. MyXPNS finds or creates the folder path, then uploads the file:

```
MyXPNS/
  MyXPNS Ledger            ← the spreadsheet (if created by the app)
  Receipts/
    2026/
      10-October/
        2026-10-03_DMart_1250.jpg
```

3. The file's Drive link (`webViewLink`) is stored in the transaction's **Receipt URL** column.

## Naming

`{date}_{merchant}_{amount}.{ext}`. The merchant is reduced to letters and digits (accents removed, at most 40 characters). It is `Receipt` when there is no merchant. Notes and other personal details never go into file names.

## Failure handling

| What failed | What happens |
|---|---|
| Upload fails (offline, Google error) | **Nothing is saved.** The form stays filled in, with **Try again** and **Save without receipt** |
| Upload succeeded, writing the row failed | The uploaded file is remembered. **Try again** writes the row without uploading the file again |
| Network dropped during the row write | On retry MyXPNS first checks whether the row already exists, so it is never duplicated |

Folder lookups are cached per session. A failed lookup is not cached, so a retry can succeed.

## Permissions

With the `drive.file` scope MyXPNS can only see folders and files it created. It never lists or reads anything else in your Drive.

## Sharing receipts

Receipts live in the Drive of whoever uploaded them. Sharing the spreadsheet does **not** share the receipts. To let a family member open your receipts, share your `MyXPNS/Receipts` folder with them in Google Drive.
