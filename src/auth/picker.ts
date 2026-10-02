import { AppError } from '../data/errors';
import { loadScript } from './loadScript';

/**
 * Google Picker lets the user choose an existing spreadsheet. Choosing a file in the
 * Picker is what grants MyXPNS (drive.file scope) access to that one file — nothing else.
 */

interface PickerDoc {
  id: string;
  name: string;
}

interface PickerResponse {
  action: string;
  docs?: PickerDoc[];
}

interface PickerNamespace {
  Action: { PICKED: string; CANCEL: string };
  ViewId: { SPREADSHEETS: string };
  DocsView: new (viewId: string) => { setMode(mode: string): unknown; setIncludeFolders(v: boolean): unknown };
  DocsViewMode: { LIST: string };
  PickerBuilder: new () => PickerBuilder;
}

interface PickerBuilder {
  addView(view: unknown): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(cb: (r: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}

declare global {
  interface Window {
    gapi?: { load(name: string, cb: { callback: () => void; onerror: () => void }): void };
  }
}

export async function pickSpreadsheet(args: { token: string; apiKey: string; appId: string }): Promise<PickerDoc | null> {
  await loadScript('https://apis.google.com/js/api.js').catch(() => {
    throw new AppError('network', 'Could not load Google Picker.');
  });
  await new Promise<void>((resolve, reject) => {
    window.gapi!.load('picker', { callback: resolve, onerror: () => reject(new AppError('network', 'Could not load Google Picker.')) });
  });
  const picker = (window as unknown as { google: { picker: PickerNamespace } }).google.picker;
  return new Promise<PickerDoc | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS);
    view.setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(args.token)
      .setDeveloperKey(args.apiKey)
      .setAppId(args.appId)
      .setTitle('Choose your finance sheet')
      .setCallback((r) => {
        if (r.action === picker.Action.PICKED && r.docs?.[0]) resolve({ id: r.docs[0].id, name: r.docs[0].name });
        else if (r.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
