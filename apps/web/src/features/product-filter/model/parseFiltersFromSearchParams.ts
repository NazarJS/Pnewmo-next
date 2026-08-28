import { FilterFiled, ProductFilters } from '@/entities/product/model/types';

type NextSearchParams = Record<string, string | string[] | undefined>;

const MIN_SUFFIX = '_min';
const MAX_SUFFIX = '_max';

function toSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | string[] | undefined): number | undefined {
  const raw = toSingleValue(value);

  if (raw === undefined || raw === '') {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseFiltersFromSearchParams(
  searchParams: NextSearchParams,
  schema: FilterFiled[],
): ProductFilters {
  const filters: ProductFilters = {};
  const fieldsByKey = new Map(schema.map((field) => [field.key, field]));
  const rangeKeys = new Set<string>();

  for (const key of Object.keys(searchParams)) {
    if (key.endsWith(MIN_SUFFIX)) {
      rangeKeys.add(key.slice(0, -MIN_SUFFIX.length));
    } else if (key.endsWith(MAX_SUFFIX)) {
      rangeKeys.add(key.slice(0, -MAX_SUFFIX.length));
    }
  }

  for (const key of rangeKeys) {
    if (fieldsByKey.get(key)?.type !== 'range') {
      continue;
    }

    const min = parseNumber(searchParams[`${key}${MIN_SUFFIX}`]);
    const max = parseNumber(searchParams[`${key}${MAX_SUFFIX}`]);

    if (min === undefined || max === undefined) {
      continue;
    }

    filters[key] = { min, max };
  }

  for (const [key, value] of Object.entries(searchParams)) {
    if (key.endsWith(MIN_SUFFIX) || key.endsWith(MAX_SUFFIX)) {
      continue;
    }

    if (fieldsByKey.get(key)?.type !== 'enum') {
      continue;
    }

    const raw = toSingleValue(value);
    if (!raw) {
      continue;
    }

    const values = raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (values.length === 0) {
      continue;
    }

    filters[key] = values;
  }

  return filters;
}
