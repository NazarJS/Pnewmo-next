import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { flattenAll, slugFromUrl, SourceCategory } from './catalog-fixture.lib';

/**
 * Пересборка фикстуры каталога из одной или нескольких выгрузок.
 *
 *   pnpm --filter @pnewmo/api catalog:fixture \
 *     ~/Downloads/pneumax_pnewmatica.json \
 *     ~/Downloads/pneumax_gidravlika.json \
 *     ~/Downloads/pneumax_smazka.json
 *
 * Порядок путей — приоритет при схлопывании дублей externalId между
 * выгрузками: побеждает первое вхождение, как и раньше внутри одной.
 *
 * Без `--` перед путями: в отличие от npm, pnpm 10 передаёт этот разделитель
 * в process.argv дословно, и argv[2] станет строкой '--', а не первым путём.
 *
 * Скрипт коммитится вместе с результатом. Без него фикстура становится
 * артефактом, который «однажды сконвертировали», и пересобрать её из новой
 * выгрузки не сможет никто, кроме автора.
 */

// Все три известные выгрузки называют корень «Гидравлика», независимо от
// того, что в нём на самом деле лежит — дефект источника, а не совпадение:
// имя корня, видимо, скопировано с первой выгрузки и с тех пор не менялось.
// У пневматики оно случайно правильно не было — только совпало по слову
// «Гидравлика» ни разу, поэтому чинить приходится все три. Соответствие
// держится явным словарём слаг -> имя, а не одной строкой на выгрузку, как
// было при одном источнике: если очередная выгрузка приедет с этим полем
// уже исправленным, достаточно убрать её слаг из словаря.
const ROOT_NAME_BY_SLUG: Record<string, string> = {
  pnevmatika: 'Пневматика',
  gidravlika: 'Гидравлика',
  smazochnaya_tekhnika: 'Смазочная техника',
};

function fixRootName(root: SourceCategory): void {
  const slug = slugFromUrl(root.url);
  const correctName = ROOT_NAME_BY_SLUG[slug];

  if (correctName === undefined) {
    // Незнакомый корень — предупреждаем и берём имя как в выгрузке, а не
    // падаем: словарь выше покрывает три известных источника, а не любой
    // будущий.
    console.warn(
      `fixture: неизвестный слаг корня «${slug}», имя оставлено как в выгрузке: «${root.name}»`,
    );

    return;
  }

  root.name = correctName;
}

function main(): void {
  const sources = process.argv.slice(2);

  if (sources.length === 0) {
    throw new Error(
      'Укажите хотя бы один путь к выгрузке: catalog:fixture <путь к json> [<путь к json> ...]',
    );
  }

  const roots = sources.map((source) => {
    const root = JSON.parse(readFileSync(source, 'utf8')) as SourceCategory;

    fixRootName(root);

    return root;
  });

  const { categories, products, droppedNonProducts, duplicatesCollapsed } = flattenAll(roots);
  const target = join(__dirname, 'catalog.json');

  writeFileSync(target, JSON.stringify({ categories, products }), 'utf8');

  console.log(`fixture: ${categories.length} categories, ${products.length} products -> ${target}`);

  // parsePrice молча возвращает null и на пустой цене, и на неразборчивой —
  // разница не в коде, а в глазах человека, который должен заметить потерю.
  // Без этой строки будущий рост числа null прошёл бы незамеченным.
  const unparsedPrices = products.filter((product) => product.price === null).length;

  console.log(`fixture: ${unparsedPrices} price(s) parsed as null (empty or unreadable source)`);

  // Смазка кладёт в products не только товары, но и описания категорий без
  // id/url/price — тот же риск тихой потери, что и с null-ценами выше.
  console.log(`fixture: ${droppedNonProducts} non-product item(s) dropped (type !== 'product')`);

  console.log(
    `fixture: ${duplicatesCollapsed} duplicate product id(s) collapsed (within and across sources)`,
  );
}

main();
