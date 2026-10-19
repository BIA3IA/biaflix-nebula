/**
 * Dialog delle raccolte: crea (film+serie), aggiungi a…, gestisci.
 * Ogni azione colpisce le API reali e mostra l'esito confermato dal server.
 */
import { canManageCollections, collectionTargetId, isForbidden, type MutationResult } from '../collections';
import type { NebulaContext } from '../context';
import { navigate, detailsPath } from '../env';
import { countLabel, t } from '../i18n';
import type { BaseItem } from '../jellyfin-api';
import { confirmDialog, openDialog } from '../ui/dialog';
import { h, icon, uniqueId } from '../ui/dom';
import { createTitlePicker } from '../ui/title-picker';
import { toast } from '../ui/toast';

function reportError(ctx: NebulaContext, err: unknown): void {
  ctx.log('errore raccolte', err);
  toast(isForbidden(err) ? t('errorForbidden') : t('errorGeneric'), 'error');
}

function reportUnconfirmed(result: MutationResult): boolean {
  if (result.unconfirmed.length) {
    toast(t('errorVerify'), 'error', 5000);
    return false;
  }
  return true;
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function openCreateCollection(ctx: NebulaContext, preselected: BaseItem[] = []): void {
  if (!canManageCollections(ctx.user)) {
    toast(t('noPermissionCollections'), 'info', 5000);
    return;
  }
  const isAdmin = ctx.user.Policy.IsAdministrator;
  const dlg = openDialog({ title: t('newCollection'), className: 'nebula-dialog--wide' });
  const form = h('form', { class: 'nebula-form', novalidate: true });
  const nameId = uniqueId('nebula-name');
  const descId = uniqueId('nebula-desc');
  const coverId = uniqueId('nebula-cover');
  const errorId = uniqueId('nebula-name-error');
  const name = h('input', {
    id: nameId,
    class: 'nebula-input',
    required: true,
    maxlength: 120,
    autocomplete: 'off',
    'aria-describedby': errorId,
    autofocus: true,
  });
  const nameError = h('p', { id: errorId, class: 'nebula-field__error', role: 'alert' });
  const desc = h('textarea', { id: descId, class: 'nebula-input nebula-textarea', rows: 2, maxlength: 600, disabled: !isAdmin });
  const cover = h('input', { id: coverId, type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'nebula-file', disabled: !isAdmin });
  const picker = createTitlePicker(ctx, { preselected });

  form.append(
    h('p', { class: 'nebula-notice' }, icon('group'), t('sharedNotice')),
    h('div', { class: 'nebula-field' }, h('label', { for: nameId, class: 'nebula-label' }, `${t('name')} *`), name, nameError),
    h(
      'div',
      { class: 'nebula-field-row' },
      h(
        'div',
        { class: 'nebula-field' },
        h('label', { for: descId, class: 'nebula-label' }, t('description')),
        desc,
        isAdmin ? null : h('p', { class: 'nebula-field__hint' }, t('descriptionAdminOnly')),
      ),
      h(
        'div',
        { class: 'nebula-field' },
        h('label', { for: coverId, class: 'nebula-label' }, t('cover')),
        cover,
        h('p', { class: 'nebula-field__hint' }, isAdmin ? t('coverHintAdmin') : t('coverHintUser')),
      ),
    ),
    picker.root,
  );
  dlg.body.append(form);

  const cancel = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass' }, t('cancel'));
  const submit = h('button', { type: 'submit', class: 'nebula-btn nebula-btn--primary' }, icon('add'), t('createCollection'));
  form.id = uniqueId('nebula-form');
  submit.setAttribute('form', form.id);
  cancel.addEventListener('click', () => dlg.close());
  dlg.footer.append(cancel, submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = name.value.trim();
    if (!value) {
      nameError.textContent = t('nameRequired');
      name.setAttribute('aria-invalid', 'true');
      name.focus();
      return;
    }
    nameError.textContent = '';
    name.removeAttribute('aria-invalid');
    dlg.setBusy(true);
    try {
      const ids = picker.selected().map((i) => collectionTargetId(i));
      const result = await ctx.collections.create(value, ids);
      // La raccolta esiste già: un errore su descrizione/cover non deve riaprire il form
      // (un nuovo invio creerebbe un duplicato). Avvisiamo e proseguiamo.
      try {
        if (isAdmin && desc.value.trim()) await ctx.api.updateOverview(result.collectionId, desc.value.trim());
        const file = cover.files?.[0];
        if (isAdmin && file) await ctx.api.uploadPrimaryImage(result.collectionId, await readFileBase64(file), file.type);
      } catch (extraErr) {
        ctx.log('descrizione/cover', extraErr);
        toast(t('extrasFailed'), 'error', 5000);
      }
      if (reportUnconfirmed(result)) toast(t('created', { name: value }));
      dlg.close();
      navigate(detailsPath(result.collectionId, ctx.serverId));
    } catch (err) {
      reportError(ctx, err);
      dlg.setBusy(false);
    }
  });
}

export function openCreatePlaylist(ctx: NebulaContext, preselected: BaseItem[] = []): void {
  const dlg = openDialog({ title: t('newPlaylist'), className: 'nebula-dialog--wide' });
  const form = h('form', { class: 'nebula-form', novalidate: true, id: uniqueId('nebula-form') });
  const nameId = uniqueId('nebula-name');
  const pubId = uniqueId('nebula-public');
  const name = h('input', { id: nameId, class: 'nebula-input', required: true, maxlength: 120, autocomplete: 'off', autofocus: true });
  const pub = h('input', { id: pubId, type: 'checkbox', class: 'nebula-check' });
  const picker = createTitlePicker(ctx, { preselected });
  form.append(
    h('p', { class: 'nebula-notice' }, icon('lock'), t('privateNotice'), ' ', t('playlistSeriesNotice')),
    h('div', { class: 'nebula-field' }, h('label', { for: nameId, class: 'nebula-label' }, `${t('name')} *`), name),
    h('label', { for: pubId, class: 'nebula-toggle' }, pub, t('publicPlaylist')),
    picker.root,
  );
  dlg.body.append(form);
  const cancel = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass' }, t('cancel'));
  const submit = h('button', { type: 'submit', class: 'nebula-btn nebula-btn--primary', form: form.id }, icon('add'), t('create'));
  cancel.addEventListener('click', () => dlg.close());
  dlg.footer.append(cancel, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = name.value.trim();
    if (!value) {
      name.setAttribute('aria-invalid', 'true');
      name.focus();
      return;
    }
    dlg.setBusy(true);
    try {
      const id = await ctx.playlists.create(
        value,
        picker.selected().map((i) => i.Id),
        pub.checked,
      );
      toast(t('playlistCreated', { name: value }));
      dlg.close();
      navigate(detailsPath(id, ctx.serverId));
    } catch (err) {
      reportError(ctx, err);
      dlg.setBusy(false);
    }
  });
}

/** «Aggiungi a…»: raccolte (con stato di appartenenza) e playlist modificabili, più «Crea nuova». */
export async function openAddTo(ctx: NebulaContext, item: BaseItem): Promise<void> {
  const target = collectionTargetId(item);
  const targetItem = target === item.Id ? item : await ctx.api.getItem(target);
  const dlg = openDialog({ title: t('addToTitle', { name: targetItem.Name }), className: 'nebula-dialog--menu' });
  const manage = canManageCollections(ctx.user);
  const status = h('p', { class: 'nebula-picker__status', role: 'status', 'aria-live': 'polite' }, t('loading'));
  dlg.body.append(status);

  try {
    const [collections, containing, playlists] = await Promise.all([
      manage ? ctx.collections.list() : Promise.resolve([]),
      manage ? ctx.collections.containing(target) : Promise.resolve(new Set<string>()),
      ctx.playlists.editable(),
    ]);
    status.textContent = '';

    if (manage) {
      const list = h('ul', { class: 'nebula-menu-list', 'aria-label': t('collections') });
      for (const c of collections) {
        const id = uniqueId('nebula-addto');
        const box = h('input', { id, type: 'checkbox', class: 'nebula-check', checked: containing.has(c.item.Id) });
        box.addEventListener('change', async () => {
          const wanted = box.checked;
          box.disabled = true;
          try {
            if (!wanted) {
              const ok = await confirmDialog(t('remove'), t('confirmRemove', { item: targetItem.Name, name: c.item.Name }), t('remove'), true);
              if (!ok) {
                box.checked = true;
                return;
              }
              if (reportUnconfirmed(await ctx.collections.remove(c.item.Id, [target]))) toast(t('removedFrom', { name: c.item.Name }));
            } else if (reportUnconfirmed(await ctx.collections.add(c.item.Id, [target]))) {
              toast(t('addedTo', { name: c.item.Name }));
            }
          } catch (err) {
            box.checked = !wanted;
            reportError(ctx, err);
          } finally {
            box.disabled = false;
          }
        });
        list.append(
          h(
            'li',
            {},
            h(
              'label',
              { for: id, class: 'nebula-menu-item' },
              box,
              icon('collections_bookmark'),
              h('span', { class: 'nebula-menu-item__name' }, c.item.Name),
              h('span', { class: 'nebula-menu-item__meta' }, countLabel(c.count)),
            ),
          ),
        );
      }
      const create = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass nebula-btn--block' }, icon('add'), t('newCollection'));
      create.addEventListener('click', () => {
        dlg.close();
        openCreateCollection(ctx, [targetItem]);
      });
      dlg.body.append(h('h3', { class: 'nebula-menu-heading' }, t('collections')), list, create);
    } else {
      dlg.body.append(h('p', { class: 'nebula-notice' }, icon('info'), t('noPermissionCollections')));
    }

    const plList = h('ul', { class: 'nebula-menu-list', 'aria-label': t('playlists') });
    for (const p of playlists) {
      const b = h('button', { type: 'button', class: 'nebula-menu-item' }, icon('playlist_add'), h('span', { class: 'nebula-menu-item__name' }, p.Name));
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await ctx.playlists.add(p.Id, [item.Id]);
          toast(t('addedTo', { name: p.Name }));
          b.replaceChildren(icon('check'), h('span', { class: 'nebula-menu-item__name' }, p.Name));
        } catch (err) {
          reportError(ctx, err);
          b.disabled = false;
        }
      });
      plList.append(h('li', {}, b));
    }
    const newPl = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass nebula-btn--block' }, icon('add'), t('newPlaylist'));
    newPl.addEventListener('click', () => {
      dlg.close();
      openCreatePlaylist(ctx, [item]);
    });
    dlg.body.append(h('h3', { class: 'nebula-menu-heading' }, t('playlists')));
    if (item.Type === 'Series') dlg.body.append(h('p', { class: 'nebula-field__hint' }, t('playlistSeriesNotice')));
    dlg.body.append(plList, newPl);
  } catch (err) {
    status.textContent = t('errorGeneric');
    reportError(ctx, err);
  }
}

/** Gestione di una raccolta: aggiungi titoli, rimuovi (con conferma), descrizione (admin), elimina. */
export async function openManageCollection(ctx: NebulaContext, collection: BaseItem, onChanged: () => void): Promise<void> {
  let dirty = false;
  const dlg = openDialog({
    title: `${t('manageCollection')}: ${collection.Name}`,
    className: 'nebula-dialog--wide',
    onClose: () => {
      if (dirty) onChanged();
    },
  });
  const membersList = h('ul', { class: 'nebula-member-list', 'aria-label': t('inCollection') });
  const reload = async () => {
    const r = await ctx.api.getChildren(collection.Id, { includeItemTypes: ['Movie', 'Series'] });
    membersList.replaceChildren(
      ...r.Items.map((m) => {
        const del = h(
          'button',
          { type: 'button', class: 'nebula-icon-btn nebula-icon-btn--danger', 'aria-label': `${t('remove')} ${m.Name}` },
          icon('remove_circle_outline'),
        );
        del.addEventListener('click', async () => {
          if (!(await confirmDialog(t('remove'), t('confirmRemove', { item: m.Name, name: collection.Name }), t('remove'), true))) return;
          try {
            if (reportUnconfirmed(await ctx.collections.remove(collection.Id, [m.Id]))) toast(t('removedFrom', { name: collection.Name }));
            await reload();
            dirty = true;
          } catch (err) {
            reportError(ctx, err);
          }
        });
        return h(
          'li',
          { class: 'nebula-member' },
          h('span', { class: 'nebula-member__name' }, m.Name),
          h('span', { class: 'nebula-member__meta' }, m.Type === 'Series' ? t('series') : t('movies')),
          del,
        );
      }),
    );
    if (!r.Items.length) membersList.append(h('li', { class: 'nebula-member nebula-member--empty' }, t('emptyCollection')));
    return new Set(r.Items.map((i) => i.Id));
  };

  const existing = await reload().catch((err) => {
    reportError(ctx, err);
    return new Set<string>();
  });
  const picker = createTitlePicker(ctx, { exclude: existing });
  const addBtn = h('button', { type: 'button', class: 'nebula-btn nebula-btn--primary' }, icon('add'), t('addTitles'));
  addBtn.addEventListener('click', async () => {
    const ids = picker.selected().map((i) => collectionTargetId(i));
    if (!ids.length) return;
    addBtn.disabled = true;
    try {
      if (reportUnconfirmed(await ctx.collections.add(collection.Id, ids))) toast(t('addedTo', { name: collection.Name }));
      dirty = true;
      dlg.close();
    } catch (err) {
      reportError(ctx, err);
      addBtn.disabled = false;
    }
  });

  const sections: HTMLElement[] = [
    h('h3', { class: 'nebula-menu-heading' }, t('inCollection')),
    membersList,
    h('h3', { class: 'nebula-menu-heading' }, t('addTitles')),
    picker.root,
  ];

  if (ctx.user.Policy.IsAdministrator) {
    const descId = uniqueId('nebula-desc');
    const desc = h('textarea', { id: descId, class: 'nebula-input nebula-textarea', rows: 2, maxlength: 600 });
    desc.value = collection.Overview ?? '';
    const saveDesc = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass' }, t('save'));
    saveDesc.addEventListener('click', async () => {
      saveDesc.disabled = true;
      try {
        await ctx.api.updateOverview(collection.Id, desc.value.trim());
        toast(t('saved'));
        dirty = true;
      } catch (err) {
        reportError(ctx, err);
      } finally {
        saveDesc.disabled = false;
      }
    });
    sections.unshift(h('div', { class: 'nebula-field' }, h('label', { for: descId, class: 'nebula-label' }, t('description')), desc, saveDesc));
  }
  dlg.body.append(...sections);

  const deleteBtn = h('button', { type: 'button', class: 'nebula-btn nebula-btn--danger-ghost' }, icon('delete'), t('delete'));
  deleteBtn.hidden = collection.CanDelete === false;
  deleteBtn.addEventListener('click', async () => {
    if (!(await confirmDialog(t('delete'), t('confirmDelete', { name: collection.Name }), t('delete'), true))) return;
    try {
      await ctx.collections.delete(collection);
      toast(t('deleted', { name: collection.Name }));
      dlg.close();
      navigate('home');
    } catch (err) {
      reportError(ctx, err);
    }
  });
  const done = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass' }, t('close'));
  done.addEventListener('click', () => dlg.close());
  dlg.footer.append(deleteBtn, h('span', { class: 'nebula-spacer' }), done, addBtn);
}
