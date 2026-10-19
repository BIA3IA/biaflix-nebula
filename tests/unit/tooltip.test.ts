import { afterEach, describe, expect, it, vi } from 'vitest';
import { installTooltips } from '../../src/scripts/ui/tooltip';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('tooltip glass', () => {
  it('sostituisce il tooltip di sistema, mantiene il nome accessibile e ripristina il title allo stop', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="icon" title="Scopri"><span class="material-icons">explore</span></button>';
    const stop = installTooltips();
    const btn = document.getElementById('icon')!;
    btn.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    expect(btn.hasAttribute('title')).toBe(false); // niente riquadro del browser
    expect(btn.getAttribute('aria-label')).toBe('Scopri'); // pulsante solo icona: il nome resta
    vi.advanceTimersByTime(400);
    const tip = document.querySelector('.nebula-tooltip')!;
    expect(tip.classList.contains('is-visible')).toBe(true);
    expect(tip.textContent).toBe('Scopri');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tip.classList.contains('is-visible')).toBe(false);
    stop();
    expect(btn.getAttribute('title')).toBe('Scopri');
    expect(btn.hasAttribute('aria-label')).toBe(false);
    expect(document.querySelector('.nebula-tooltip')).toBeNull();
  });

  it('non tocca il nome accessibile esistente e ignora la dashboard e il tocco', () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<a id="a" title="Vedi tutti" aria-label="Vedi tutti i film">→</a><div class="dashboardDocument"><button id="d" title="Admin">x</button></div>';
    const stop = installTooltips();
    const a = document.getElementById('a')!;
    a.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    expect(a.getAttribute('aria-label')).toBe('Vedi tutti i film');
    const d = document.getElementById('d')!;
    d.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    expect(d.getAttribute('title')).toBe('Admin');
    stop();
  });
});
