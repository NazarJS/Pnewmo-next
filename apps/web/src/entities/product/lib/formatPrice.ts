const formatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
});

/**
 * Цена приходит строкой от самого Postgres: Decimal через number теряет
 * точность, 21493.96 превращается в 21493.959999999999. Number вызывается
 * здесь, в последней точке перед показом, где потеря уже безразлична.
 *
 * null — это «цена неизвестна», а не «бесплатно». Показывать ноль было бы
 * враньём, поэтому у 4 товаров каталога будет «Цена по запросу».
 */
export function formatPrice(value: string | null): string {
  if (value === null) {
    return 'Цена по запросу';
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? formatter.format(parsed) : 'Цена по запросу';
}
