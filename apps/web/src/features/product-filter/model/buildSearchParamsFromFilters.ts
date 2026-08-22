import { ProductFilters } from '@/entities/product/model/types';

export function buildSearchParamsFromFilters(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(','));
      }
      continue;
    }

    params.set(`${key}_min`, String(value.min));
    params.set(`${key}_max`, String(value.max));
  }

  return params;
}
