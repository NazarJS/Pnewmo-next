import {
  cleanSpecifications,
  flatten,
  parsePrice,
  slugFromUrl,
  SourceCategory,
} from './catalog-fixture.lib';

describe('slugFromUrl', () => {
  it('берёт последний сегмент', () => {
    expect(slugFromUrl('https://pneumax.ru/catalog/pnevmatika/')).toBe('pnevmatika');
  });
});

describe('parsePrice', () => {
  it('разбирает цену с пробелами и рублём', () => {
    expect(parsePrice('21 493.96 ₽')).toBe(21493.96);
  });

  it('пустую цену превращает в null, а не в ноль', () => {
    expect(parsePrice('')).toBeNull();
  });

  it('неразбираемую цену превращает в null', () => {
    expect(parsePrice('по запросу')).toBeNull();
  });
});

describe('cleanSpecifications', () => {
  it('выбрасывает метаданные CMS и оставляет свойства товара', () => {
    const result = cleanSpecifications({
      'Диаметр поршня, мм': '63',
      Рейтинг: '3.3',
      'Сумма оценок': '5',
      'Количество проголосовавших': '1',
      'Название для 2GIS': 'Цилиндр',
      'Текст Alt Картинке': 'фото',
    });

    expect(result).toEqual({ 'Диаметр поршня, мм': '63' });
  });

  it('переживает отсутствие характеристик', () => {
    expect(cleanSpecifications(undefined)).toEqual({});
  });
});

describe('flatten', () => {
  const tree: SourceCategory = {
    name: 'Корень',
    url: 'https://x/catalog/root/',
    products: [],
    subcategories: [
      {
        name: 'Ветка',
        url: 'https://x/catalog/branch/',
        products: [
          {
            id: '1',
            fullTitle: 'Товар А',
            image: 'a.webp',
            price: '10 ₽',
            characteristics: { short: { Серия: '1390' } },
          },
        ],
        subcategories: [
          {
            name: 'Лист',
            url: 'https://x/catalog/leaf/',
            products: [
              {
                id: '1',
                fullTitle: 'Товар А снова',
                image: 'a2.webp',
                price: '20 ₽',
                characteristics: { short: {} },
              },
              {
                id: '2',
                fullTitle: 'Товар Б',
                image: 'b.webp',
                price: '30 ₽',
                characteristics: { short: {} },
              },
            ],
          },
        ],
      },
    ],
  };

  it('строит путь из позиций в дереве', () => {
    const { categories } = flatten(tree);

    expect(categories.map((c) => c.path)).toEqual(['1', '1.2', '1.2.3']);
    expect(categories.map((c) => c.slug)).toEqual(['root', 'branch', 'leaf']);
  });

  it('схлопывает дубли externalId, оставляя первое вхождение', () => {
    const { products } = flatten(tree);

    expect(products.map((p) => p.externalId)).toEqual(['1', '2']);
    expect(products[0].name).toBe('Товар А');
    expect(products[0].categoryPath).toBe('1.2');
  });
});
