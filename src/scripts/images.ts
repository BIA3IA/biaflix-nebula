/** Scelta immagini Jellyfin per tipo di card, con srcset coerente con la dimensione resa e il DPR. */
import type { BaseItem, ImageType, JellyfinApi } from './jellyfin-api';

export interface ImageRef {
  itemId: string;
  type: ImageType;
  tag?: string;
}

export function posterImage(item: BaseItem): ImageRef | null {
  if (item.ImageTags?.Primary) return { itemId: item.Id, type: 'Primary', tag: item.ImageTags.Primary };
  if (item.SeriesId && item.SeriesPrimaryImageTag) return { itemId: item.SeriesId, type: 'Primary', tag: item.SeriesPrimaryImageTag };
  return null;
}

export function backdropImage(item: BaseItem): ImageRef | null {
  const own = item.BackdropImageTags?.[0];
  if (own) return { itemId: item.Id, type: 'Backdrop', tag: own };
  const parent = item.ParentBackdropImageTags?.[0];
  if (parent && item.ParentBackdropItemId) return { itemId: item.ParentBackdropItemId, type: 'Backdrop', tag: parent };
  return null;
}

/** 16:9: thumb episodio → thumb → backdrop. */
export function wideImage(item: BaseItem): ImageRef | null {
  if (item.Type === 'Episode' && item.ImageTags?.Primary) return { itemId: item.Id, type: 'Primary', tag: item.ImageTags.Primary };
  if (item.ImageTags?.Thumb) return { itemId: item.Id, type: 'Thumb', tag: item.ImageTags.Thumb };
  if (item.ParentThumbItemId && item.ParentThumbImageTag) return { itemId: item.ParentThumbItemId, type: 'Thumb', tag: item.ParentThumbImageTag };
  return backdropImage(item);
}

export function logoImage(item: BaseItem): ImageRef | null {
  return item.ImageTags?.Logo ? { itemId: item.Id, type: 'Logo', tag: item.ImageTags.Logo } : null;
}

export function srcset(api: JellyfinApi, ref: ImageRef, cssWidth: number, densities: readonly number[] = [1, 1.5, 2]): { src: string; srcset: string } {
  const urls = densities.map((d) => {
    const w = Math.round(cssWidth * d);
    return `${api.imageUrl(ref.itemId, ref.type, { tag: ref.tag, width: w })} ${w}w`;
  });
  return { src: api.imageUrl(ref.itemId, ref.type, { tag: ref.tag, width: cssWidth }), srcset: urls.join(', ') };
}
