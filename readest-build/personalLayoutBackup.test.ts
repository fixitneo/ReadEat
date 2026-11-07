import { describe, expect, it } from 'vitest';
import type { BookConfig } from '@/types/book';
import type { SystemSettings } from '@/types/settings';
import {
  DEFAULT_PERSONAL_BACKUP,
  filterPersonalBookConfig,
  mergePersonalBookConfig,
  filterPersonalSettings,
} from '@/utils/personalBackupSelection';

describe('Readest Personal portable view-layout settings', () => {
  it('exports the exact four margins and spread/layout values per book', () => {
    const viewSettings = {
      marginLeftPx: 40, marginRightPx: 41, marginTopPx: 50, marginBottomPx: 51,
      compactMarginLeftPx: 9, compactMarginRightPx: 10,
      compactMarginTopPx: 11, compactMarginBottomPx: 12,
      columnGapPx: 23, gapPercent: 8, scrolled: false,
    };
    const snapshot = filterPersonalBookConfig({
      viewSettings,
      updatedAt: 3,
    } as unknown as Partial<BookConfig>, DEFAULT_PERSONAL_BACKUP);
    expect(snapshot.viewSettings).toMatchObject(viewSettings);
    const restored = mergePersonalBookConfig({
      viewSettings: {...viewSettings, marginLeftPx: 1},
    } as unknown as Partial<BookConfig>,snapshot,DEFAULT_PERSONAL_BACKUP);
    expect(restored.viewSettings).toMatchObject(viewSettings);
  });
  it('exports global margins only when layouts are selected', () => {
    const settings = {
      globalViewSettings: {
        marginLeftPx: 40, marginRightPx: 41,
        marginTopPx: 50, marginBottomPx: 51,
      },
    } as unknown as SystemSettings;
    const withLayout = filterPersonalSettings(settings, {
      ...DEFAULT_PERSONAL_BACKUP, appSettings:false, layouts:true,
    });
    expect(withLayout.globalViewSettings).toMatchObject(settings.globalViewSettings);
    const withoutLayout = filterPersonalSettings(settings, {
      ...DEFAULT_PERSONAL_BACKUP, appSettings:false, layouts:false, css:false,
    });
    expect(withoutLayout.globalViewSettings).toBeUndefined();
  });
});
