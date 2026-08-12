import { ProductFilters } from "@/entities/product/model/types";

export function buildFilterQueryParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      // OR внутри группы — оператор `in`, значения через запятую.
      // НЕ через повтор параметра (append) — в этой версии json-server
      // повтор ключа не даёт OR, выживает последнее значение.
      params.set(`specifications.${key}_in`, value.join(","));
    } else {
      params.set(`spec_${key}_value_gte`, String(value.min));
      params.set(`spec_${key}_value_lte`, String(value.max));
    }
  }

  return params;
}
