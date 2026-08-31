import {
  cleanSpecifications,
  flatten,
  flattenAll,
  parsePrice,
  slugFromUrl,
  SourceCategory,
  SourceProduct,
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

  it('склеенную «было/стало» пару цен превращает в null, а не в конкатенацию цифр', () => {
    // Обнаружено в гидравлике: 23 товара из 2139 несут в price два значения
    // подряд без разделителя, похоже на «было/стало» без разметки. Наивная
    // склейка цифр даёт абсурдное число — «1 029 314 ₽» и «720 519.80 ₽»
    // превращаются в 1029314720519.8, которое к тому же не помещается в
    // NUMERIC(12,2) и роняет вставку в базу.
    const raw = '1 029 314 ₽\n                                        720 519.80 ₽';

    expect(parsePrice(raw)).toBeNull();
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

  it('приводит нестроковое значение к строке', () => {
    // Источник — произвольный JSON: тип Record<string, string> лишь
    // обещание, следующая выгрузка может прислать число для того же ключа.
    const dirty = { 'Диаметр поршня, мм': 63 } as unknown as Record<string, string>;

    expect(cleanSpecifications(dirty)).toEqual({ 'Диаметр поршня, мм': '63' });
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
            type: 'product',
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
                type: 'product',
                id: '1',
                fullTitle: 'Товар А снова',
                image: 'a2.webp',
                price: '20 ₽',
                characteristics: { short: {} },
              },
              {
                type: 'product',
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

describe('flattenAll (фильтрация не-товаров)', () => {
  it('отбрасывает элементы, у которых type не product, и считает их', () => {
    // Выгрузка смазки кладёт в products не только товары: 60 из 670
    // элементов — описания категорий (type: 'category_info') без id, url,
    // price. Такой элемент нельзя типизировать как SourceProduct честно —
    // тем и опасен: приедет без обязательных полей и без проверки типа
    // попал бы в фикстуру как товар с price: undefined.
    const categoryInfo = {
      type: 'category_info',
      title: 'Описание категории',
    } as unknown as SourceProduct;

    const root: SourceCategory = {
      name: 'Смазка',
      url: 'https://x/catalog/smazka/',
      products: [
        {
          type: 'product',
          id: '1',
          fullTitle: 'Товар',
          image: 'a.webp',
          price: '10 ₽',
          characteristics: { short: {} },
        },
        categoryInfo,
      ],
    };

    const { products, droppedNonProducts } = flattenAll([root]);

    expect(products.map((p) => p.externalId)).toEqual(['1']);
    expect(droppedNonProducts).toBe(1);
  });
});

describe('flattenAll (несколько корней)', () => {
  const rootA: SourceCategory = {
    name: 'Пневматика',
    url: 'https://x/catalog/pnevmatika/',
    products: [],
    subcategories: [
      {
        name: 'Клапаны',
        url: 'https://x/catalog/klapany/',
        products: [
          {
            type: 'product',
            id: '1',
            fullTitle: 'Товар А из пневматики',
            image: 'a.webp',
            price: '10 ₽',
            characteristics: { short: {} },
          },
        ],
      },
    ],
  };

  const rootB: SourceCategory = {
    name: 'Гидравлика',
    url: 'https://x/catalog/gidravlika/',
    products: [],
    subcategories: [
      {
        name: 'Насосы',
        url: 'https://x/catalog/nasosy/',
        products: [
          {
            type: 'product',
            id: '1',
            fullTitle: 'Товар А из гидравлики (дубль)',
            image: 'b.webp',
            price: '20 ₽',
            characteristics: { short: {} },
          },
          {
            type: 'product',
            id: '2',
            fullTitle: 'Товар Б',
            image: 'c.webp',
            price: '30 ₽',
            characteristics: { short: {} },
          },
        ],
      },
    ],
  };

  it('собирает несколько корней в одну фикстуру с непересекающимися путями', () => {
    const { categories } = flattenAll([rootA, rootB]);

    // Счётчик путей продолжается через корни, а не начинается заново:
    // иначе второй корень получил бы те же пути, что первый, и категории
    // из разных выгрузок конфликтовали бы при вставке в базу.
    expect(categories.map((c) => c.path)).toEqual(['1', '1.2', '3', '3.4']);
    expect(categories.map((c) => c.name)).toEqual([
      'Пневматика',
      'Клапаны',
      'Гидравлика',
      'Насосы',
    ]);
  });

  it('схлопывает дубли externalId между выгрузками, приоритет — по порядку корней', () => {
    const { products, duplicatesCollapsed } = flattenAll([rootA, rootB]);

    expect(products.map((p) => p.externalId)).toEqual(['1', '2']);
    expect(products[0].name).toBe('Товар А из пневматики');
    expect(duplicatesCollapsed).toBe(1);
  });
});
