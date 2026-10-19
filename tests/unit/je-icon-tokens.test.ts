import { describe, expect, it } from 'vitest';
import { installJeIconTokenFix, stripIconTokens } from '../../src/scripts/compat/je-icon-tokens';

describe('correttivo token icone di Jellyfin Enhanced', () => {
  it('rimuove solo i token {{icon:…}} irrisolti', () => {
    expect(stripIconTokens('{{icon:warning}} Please select at least one season')).toBe('Please select at least one season');
    expect(stripIconTokens('Richiesta inviata {{icon:checkCircle}}')).toBe('Richiesta inviata ');
    expect(stripIconTokens('Nessun token {qui}')).toBe('Nessun token {qui}');
  });

  it('avvolge JE.t dopo l’inizializzazione e ripristina l’originale allo stop', () => {
    // Comportamento di JE 12.12 con «Use Icons» spento: il segnaposto resta.
    const original = (key: string) => (key === 'season' ? '{{icon:warning}} Please select at least one season' : key);
    const je: { initialized: boolean; t: typeof original } = { initialized: true, t: original };
    const stop = installJeIconTokenFix({ JellyfinEnhanced: je as never });
    expect(je.t('season')).toBe('Please select at least one season');
    stop();
    expect(je.t).toBe(original);
  });

  it('non tocca JE prima che sia inizializzato', () => {
    const t = () => '{{icon:x}} a';
    const je = { initialized: false, t };
    const stop = installJeIconTokenFix({ JellyfinEnhanced: je as never });
    expect(je.t).toBe(t);
    stop();
  });
});
