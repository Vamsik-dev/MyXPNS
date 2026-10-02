import type { GoogleClient } from './http';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Private (per-app) marker on ledgers created or connected by MyXPNS. */
export const LEDGER_APP_PROPERTY = { key: 'myxpns', value: 'ledger' } as const;

interface DriveFile {
  id: string;
  name?: string;
  webViewLink?: string;
  modifiedTime?: string;
  parents?: string[];
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function folderQuery(name: string, parentId: string): string {
  return `name = '${escapeQuery(name)}' and mimeType = '${FOLDER_MIME}' and '${escapeQuery(parentId)}' in parents and trashed = false`;
}

/**
 * Finds or creates a folder path such as MyXPNS/Receipts/2026/10-October.
 * With the drive.file scope Drive only returns folders this app created, which is
 * exactly what we want: MyXPNS never looks at the rest of the user's Drive.
 */
export class FolderResolver {
  private cache = new Map<string, Promise<string>>();
  private readonly client: GoogleClient;
  constructor(client: GoogleClient) {
    this.client = client;
  }

  resolve(path: string[]): Promise<string> {
    let parent: Promise<string> = Promise.resolve('root');
    path.forEach((name, i) => {
      const key = path.slice(0, i + 1).join('/');
      let cached = this.cache.get(key);
      if (!cached) {
        cached = parent.then((parentId) => this.findOrCreate(name, parentId));
        // Don't cache failures, so a retry can succeed.
        cached.catch(() => this.cache.delete(key));
        this.cache.set(key, cached);
      }
      parent = cached;
    });
    return parent;
  }

  private async findOrCreate(name: string, parentId: string): Promise<string> {
    const params = new URLSearchParams({ q: folderQuery(name, parentId), fields: 'files(id)', spaces: 'drive', pageSize: '1' });
    const found = await this.client.request<{ files: DriveFile[] }>(`${DRIVE}/files?${params}`);
    if (found.files[0]) return found.files[0].id;
    const created = await this.client.request<DriveFile>(`${DRIVE}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return created.id;
  }
}

export async function uploadFile(
  client: GoogleClient,
  args: { name: string; mimeType: string; folderId: string; data: Blob },
): Promise<{ id: string; webViewLink: string }> {
  const boundary = `myxpns-${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  const metadata = JSON.stringify({ name: args.name, mimeType: args.mimeType, parents: [args.folderId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${args.mimeType}\r\n\r\n`,
    args.data,
    `\r\n--${boundary}--`,
  ]);
  const file = await client.request<DriveFile>(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return { id: file.id, webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view` };
}

/** Ledgers MyXPNS can open for this user, most recently modified first. */
export async function findLedgers(client: GoogleClient): Promise<{ id: string; name: string }[]> {
  const q = `appProperties has { key='${LEDGER_APP_PROPERTY.key}' and value='${LEDGER_APP_PROPERTY.value}' } and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const params = new URLSearchParams({ q, fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '10', spaces: 'drive' });
  const res = await client.request<{ files: DriveFile[] }>(`${DRIVE}/files?${params}`);
  return res.files.map((f) => ({ id: f.id, name: f.name ?? 'MyXPNS Ledger' }));
}

/** Marks a spreadsheet as a MyXPNS ledger and optionally moves it into a folder. */
export async function tagLedger(client: GoogleClient, fileId: string, moveToFolderId?: string): Promise<void> {
  const params = new URLSearchParams({ fields: 'id' });
  if (moveToFolderId) {
    const current = await client.request<DriveFile>(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=parents`);
    params.set('addParents', moveToFolderId);
    const remove = (current.parents ?? []).filter((p) => p !== moveToFolderId);
    if (remove.length) params.set('removeParents', remove.join(','));
  }
  await client.request(`${DRIVE}/files/${encodeURIComponent(fileId)}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appProperties: { [LEDGER_APP_PROPERTY.key]: LEDGER_APP_PROPERTY.value } }),
  });
}
