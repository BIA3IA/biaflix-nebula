import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeGlassSelect, commitValue, installGlassSelect, isEnhanceable, openGlassSelect } from '../../src/scripts/ui/glass-select';

function makeSelect(
  html = '<option value="a">Alfa</option><option value="b">Beta</option><option value="c" disabled>Gamma</option><option value="d">Delta</option>',
): HTMLSelectElement {
  document.body.innerHTML = `<label for="s">Lingua</label><select id="s">${html}</select>`;
  return document.getElementById('s') as HTMLSelectElement;
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

afterEach(() => {
  closeGlassSelect();
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('glass select', () => {
  it('lascia native multiple, size>1, disabilitate, dashboard e opt-out', () => {
    const s = makeSelect();
    expect(isEnhanceable(s)).toBe(true);
    s.multiple = true;
    expect(isEnhanceable(s)).toBe(false);
    s.multiple = false;
    s.size = 4;
    expect(isEnhanceable(s)).toBe(false);
    s.size = 0;
    s.setAttribute('data-nebula-native', '');
    expect(isEnhanceable(s)).toBe(false);
    s.removeAttribute('data-nebula-native');
    document.body.classList.add('dashboardDocument');
    expect(isEnhanceable(s)).toBe(false);
  });

  it('commitValue usa il setter del prototipo (compatibile con React) e notifica input+change', () => {
    const s = makeSelect();
    // Simula il value tracker di React: una proprietà sull'istanza che "nasconde" il setter.
    let tracked = s.value;
    Object.defineProperty(s, 'value', { configurable: true, get: () => tracked, set: (v: string) => (tracked = v) });
    const events: string[] = [];
    s.addEventListener('input', () => events.push('input'));
    s.addEventListener('change', () => events.push('change'));
    expect(commitValue(s, 'b')).toBe(true);
    expect(tracked).toBe('a'); // il tracker non è stato aggiornato: React vedrà il cambio
    expect(Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.get!.call(s)).toBe('b');
    expect(events).toEqual(['input', 'change']);
  });

  it('popup accessibile: tastiera, salto delle opzioni disabilitate, scelta e ripristino focus', async () => {
    const s = makeSelect();
    const onChange = vi.fn();
    s.addEventListener('change', onChange);
    openGlassSelect(s);
    await frame();
    const pop = document.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(pop.getAttribute('aria-label')).toBe('Lingua');
    expect(s.getAttribute('aria-expanded')).toBe('true');
    expect(pop.querySelectorAll('[role="option"]')).toHaveLength(4);
    const key = (k: string) => pop.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('ArrowDown'); // Beta
    key('ArrowDown'); // salta Gamma (disabilitata) → Delta
    expect(pop.querySelector('.is-active')!.textContent).toContain('Delta');
    key('Enter');
    expect(s.value).toBe('d');
    expect(onChange).toHaveBeenCalledOnce();
    expect(s.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(s);
  });

  it('ESC chiude senza cambiare valore; typeahead seleziona per iniziale', async () => {
    const s = makeSelect();
    openGlassSelect(s);
    await frame();
    let pop = document.querySelector<HTMLElement>('[role="listbox"]')!;
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(s.value).toBe('a');
    openGlassSelect(s);
    await frame();
    pop = document.querySelectorAll<HTMLElement>('[role="listbox"]')[document.querySelectorAll('[role="listbox"]').length - 1]!;
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(s.value).toBe('d');
  });

  it('delega globale: mousedown sulla select apre il popup al posto del picker nativo', () => {
    const s = makeSelect();
    const stop = installGlassSelect();
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    s.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    stop();
  });
});
