import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ImportFromFolderDialog from '@/app/library/components/ImportFromFolderDialog';
import type { WatchedFolder } from '@/app/library/components/WatchedFoldersPane';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string, options?: Record<string, string | number>) => {
    if (!options) return key;
    return key.replace(/{{(\w+)}}/g, (_match, name) => String(options[name] ?? ''));
  },
}));

vi.mock('@/hooks/useKeyDownActions', () => ({
  useKeyDownActions: () => ({ current: null }),
}));

vi.mock('@/components/Dialog', () => ({
  __esModule: true,
  default: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title?: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div role='dialog' aria-label={title}>
        {children}
      </div>
    ) : null,
}));

const WATCHED: WatchedFolder[] = [
  { path: '/Users/me/Books', flatten: false },
  { path: '/Users/me/Comics', flatten: true },
];

const setup = (overrides: Partial<React.ComponentProps<typeof ImportFromFolderDialog>> = {}) => {
  const props = {
    initialDirectory: '/Users/me/Books',
    initialReadInPlace: true,
    initialAutoImport: true,
    watchedFolders: WATCHED,
    onPickDirectory: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onUnwatchFolder: vi.fn(),
    onSetWatchedFolderFlatten: vi.fn(),
    ...overrides,
  };
  const utils = render(<ImportFromFolderDialog {...props} />);
  return { ...utils, props };
};

const openPane = () => fireEvent.click(screen.getByText('Watched Folders'));

afterEach(cleanup);

describe('Import-from-Folder dialog: watched folders pane', () => {
  it('hides the entry row when no folder is watched', () => {
    setup({ watchedFolders: [] });

    expect(screen.queryByText('Watched Folders')).toBeNull();
  });

  it('opens the pane in place of the import form and comes back', () => {
    setup();
    expect(screen.getByText('File Formats')).toBeTruthy();

    openPane();
    // The import form is replaced, not merely scrolled past — no OK button to
    // hit while managing folders.
    expect(screen.queryByText('File Formats')).toBeNull();
    expect(screen.queryByText('OK')).toBeNull();
    expect(screen.getByText('/Users/me/Books')).toBeTruthy();
    expect(screen.getByText('/Users/me/Comics')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByText('File Formats')).toBeTruthy();
  });

  it('shows each folder by name with its current structure', () => {
    setup();
    openPane();

    expect(screen.getByText('Books')).toBeTruthy();
    expect(screen.getByText('Comics')).toBeTruthy();
    const selects = screen.getAllByLabelText('Folder Structure');
    expect((selects[0] as HTMLSelectElement).value).toBe('keep');
    expect((selects[1] as HTMLSelectElement).value).toBe('flatten');
  });

  it('reports a structure change for the right folder', () => {
    const { props } = setup();
    openPane();

    fireEvent.change(screen.getAllByLabelText('Folder Structure')[1]!, {
      target: { value: 'keep' },
    });

    expect(props.onSetWatchedFolderFlatten).toHaveBeenCalledWith('/Users/me/Comics', false);
  });

  it('removes the correct folder only after the catalog-removal confirmation', async () => {
    const {props}=setup();openPane();
    fireEvent.click(screen.getAllByLabelText('감시 폴더 삭제')[0]!);
    expect(props.onUnwatchFolder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('폴더 및 연결된 책 제거'));
    await waitFor(()=>expect(props.onUnwatchFolder).toHaveBeenCalledWith('/Users/me/Books'));
  });

  it('clears the deleted current folder so OK cannot immediately import it again', async () => {
    const {props}=setup();openPane();
    fireEvent.click(screen.getAllByLabelText('감시 폴더 삭제')[0]!);
    fireEvent.click(screen.getByText('폴더 및 연결된 책 제거'));
    await waitFor(()=>expect((screen.getByLabelText('Back') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText('Back'));
    expect((screen.getByText('OK').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('replaces a watched path through the native picker and updates the import form', async () => {
    const replace=vi.fn().mockResolvedValue(undefined);
    const {props}=setup({onReplaceWatchedFolder:replace,onPickDirectory:vi.fn().mockResolvedValue('/Users/me/New')});
    openPane();fireEvent.click(screen.getAllByText('폴더 변경')[0]!);
    await waitFor(()=>expect(replace).toHaveBeenCalledWith('/Users/me/Books','/Users/me/New'));
    await waitFor(()=>expect((screen.getByLabelText('Back') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText('Back'));fireEvent.click(screen.getByText('OK'));
    expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({directory:'/Users/me/New',autoImport:true}));
  });

  it('keeps the import form in sync when the current folder changes structure', async () => {
    const { props } = setup();
    openPane();
    fireEvent.change(screen.getAllByLabelText('Folder Structure')[0]!, {
      target: { value: 'flatten' },
    });
    await waitFor(()=>expect((screen.getByLabelText('Back') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText('Back'));

    fireEvent.click(screen.getByText('OK'));
    expect(props.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ flatten: true }));
  });
});
