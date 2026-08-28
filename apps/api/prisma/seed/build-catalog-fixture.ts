import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { flatten, SourceCategory } from './catalog-fixture.lib';

/**
 * Пересборка фикстуры каталога из выгрузки.
 *
 *   pnpm --filter @pnewmo/api catalog:fixture -- ~/Downloads/pneumax_pnewmatica.json
 *
 * Скрипт коммитится вместе с результатом. Без него фикстура становится
 * артефактом, который «однажды сконвертировали», и пересобрать её из новой
 * выгрузки не сможет никто, кроме автора.
 */
function main(): void {
  const source = process.argv[2];

  if (!source) {
    throw new Error('Укажите путь к выгрузке: catalog:fixture -- <путь к json>');
  }

  const root = JSON.parse(readFileSync(source, 'utf8')) as SourceCategory;

  // В выгрузке корень назван «Гидравлика», хотя его url — /catalog/pnevmatika/,
  // а все шесть детей пневматические. Это ошибка источника. Правка стоит здесь
  // отдельной заметной строкой, а не прячется в данных: если следующая выгрузка
  // приедет исправленной, строку надо будет снять.
  root.name = 'Пневматика';

  const fixture = flatten(root);
  const target = join(__dirname, 'catalog.json');

  writeFileSync(target, JSON.stringify(fixture), 'utf8');

  console.log(
    `fixture: ${fixture.categories.length} categories, ${fixture.products.length} products -> ${target}`,
  );
}

main();
