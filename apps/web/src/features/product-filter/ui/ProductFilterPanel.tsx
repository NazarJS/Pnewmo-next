'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FilterFiled, ProductFilters } from '@/entities/product/model/types';
import { buildSearchParamsFromFilters } from '../model/buildSearchParamsFromFilters';
import styles from './ProductFilterPanel.module.scss';

type RangeField = Extract<FilterFiled, { type: 'range' }>;
type EnumField = Extract<FilterFiled, { type: 'enum' }>;
type RangeValue = { min: number; max: number };

interface ProductFilterPanelProps {
  schema: FilterFiled[];
  counts: Record<string, Record<string, number> | null>;
  activeFilters: ProductFilters;
}

const RANGE_PUSH_DELAY_MS = 300;

function getSelectedValues(field: EnumField, activeFilters: ProductFilters): string[] {
  const active = activeFilters[field.key];
  return Array.isArray(active) ? active : [];
}

function buildRangeDraft(
  schema: FilterFiled[],
  activeFilters: ProductFilters,
): Record<string, RangeValue> {
  const draft: Record<string, RangeValue> = {};

  for (const field of schema) {
    if (field.type !== 'range') {
      continue;
    }

    const active = activeFilters[field.key];
    draft[field.key] =
      active && !Array.isArray(active) ? active : { min: field.min, max: field.max };
  }

  return draft;
}

const ProductFilterPanel = ({ schema, counts, activeFilters }: ProductFilterPanelProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [prevActiveFilters, setPrevActiveFilters] = useState(activeFilters);
  const [rangeDraft, setRangeDraft] = useState<Record<string, RangeValue>>(() =>
    buildRangeDraft(schema, activeFilters),
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (activeFilters !== prevActiveFilters) {
    setPrevActiveFilters(activeFilters);
    setRangeDraft(buildRangeDraft(schema, activeFilters));
  }

  useEffect(() => {
    return () => {
      if (pushTimeoutRef.current) {
        clearTimeout(pushTimeoutRef.current);
      }
    };
  }, []);

  if (schema.length === 0) {
    return null;
  }

  const pushFilters = (nextFilters: ProductFilters) => {
    const query = buildSearchParamsFromFilters(nextFilters).toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleRangeChange = (field: RangeField, edge: 'min' | 'max', rawValue: string) => {
    if (rawValue === '') {
      return;
    }

    const value = Number(rawValue);
    if (Number.isNaN(value)) {
      return;
    }

    const nextRange: RangeValue = { ...rangeDraft[field.key], [edge]: value };
    setRangeDraft((prev) => ({ ...prev, [field.key]: nextRange }));

    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
    }

    pushTimeoutRef.current = setTimeout(() => {
      pushFilters({ ...activeFilters, [field.key]: nextRange });
    }, RANGE_PUSH_DELAY_MS);
  };

  const handleEnumToggle = (field: EnumField, value: string, checked: boolean) => {
    const current = getSelectedValues(field, activeFilters);
    const nextValues = checked ? [...current, value] : current.filter((item) => item !== value);

    const nextFilters = { ...activeFilters };
    if (nextValues.length > 0) {
      nextFilters[field.key] = nextValues;
    } else {
      delete nextFilters[field.key];
    }

    pushFilters(nextFilters);
  };

  const toggleSection = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderRangeBody = (field: RangeField) => {
    const draft = rangeDraft[field.key] ?? { min: field.min, max: field.max };

    return (
      <div className={styles.range}>
        <input
          type="number"
          className={styles.rangeInput}
          min={field.min}
          max={field.max}
          value={draft.min}
          onChange={(event) => handleRangeChange(field, 'min', event.target.value)}
          aria-label={`${field.label}, от`}
        />
        <span className={styles.rangeDivider}>—</span>
        <input
          type="number"
          className={styles.rangeInput}
          min={field.min}
          max={field.max}
          value={draft.max}
          onChange={(event) => handleRangeChange(field, 'max', event.target.value)}
          aria-label={`${field.label}, до`}
        />
      </div>
    );
  };

  const renderEnumBody = (field: EnumField) => {
    const fieldCounts = counts[field.key] ?? null;
    const selectedValues = getSelectedValues(field, activeFilters);

    return field.values.map((value) => {
      const count = fieldCounts?.[value];
      const isDisabled = count === 0;

      return (
        <label key={value} className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={selectedValues.includes(value)}
            disabled={isDisabled}
            onChange={(event) => handleEnumToggle(field, value, event.target.checked)}
          />
          {value}
          {count !== undefined && count !== null ? ` (${count})` : ''}
        </label>
      );
    });
  };

  return (
    <aside className={styles.panel}>
      <h3 className={styles.title}>ФИЛЬТР</h3>

      {schema.map((field) => {
        const isExpanded = expandedKeys.has(field.key);
        const panelId = `product-filter-panel-${field.key}`;

        return (
          <div key={field.key} className={styles.section}>
            <button
              type="button"
              className={styles.sectionHeader}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              onClick={() => toggleSection(field.key)}
            >
              <span
                className={isExpanded ? styles.iconMinus : styles.iconPlus}
                aria-hidden="true"
              />
              <span className={styles.sectionLabel}>
                {field.label}
                {field.type === 'range' && field.unit ? `, ${field.unit}` : ''}
              </span>
            </button>

            <div
              id={panelId}
              className={
                isExpanded ? `${styles.sectionBody} ${styles.sectionBodyExpanded}` : styles.sectionBody
              }
              inert={!isExpanded}
            >
              <div className={styles.sectionBodyClip}>
                <div className={styles.sectionBodyInner}>
                  {field.type === 'range' ? renderRangeBody(field) : renderEnumBody(field)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
};

export default ProductFilterPanel;
