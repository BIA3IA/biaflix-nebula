import { describe, expect, it } from 'vitest';
import { disableScreensaver, screensaverKey } from '../../src/scripts/compat/no-screensaver';

describe('screensaver disattivato', () => {
  it('scrive la chiave usata da jellyfin-web (appSettings `<userId>-screensaver`) solo se serve', () => {
    localStorage.setItem(screensaverKey('u1'), 'backdropscreensaver');
    expect(disableScreensaver('u1')).toBe(true);
    expect(localStorage.getItem('u1-screensaver')).toBe('none');
    expect(disableScreensaver('u1')).toBe(false);
  });
});
