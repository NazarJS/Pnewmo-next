// Реальный json-server (1.0.0-beta.15) не поддерживает regex/_like — только
// lt/lte/gt/gte/eq/ne/in/contains/startsWith/endsWith. startsWith/endsWith
// нужно передавать через colon-синтаксис ("category_path:startsWith"),
// т.к. camelCase-имя оператора не проходит через _-совместимый разбор ключей.
//
// "Поддерево категории" — это два условия: сам узел (eq) ИЛИ его потомки
// (startsWith "path."). У этого API нет OR между разными полями в одном
// запросе, поэтому это два раздельных запроса, которые нужно слить и
// дедуплицировать по id на клиенте (см. fetchProductsInCategoryScope
// в products.api.ts). Самостоятельный eq-запрос обязателен: в данных уже
// есть товар (hyd_cyl_01, category_id=37), подвешенный прямо на нелистовую
// категорию — без eq-варианта он бы молча выпадал из выдачи.

export function categoryDescendantsParam(categoryPath: string): [string, string] {
  return ["category_path:startsWith", `${categoryPath}.`];
}

export function categorySelfParam(categoryPath: string): [string, string] {
  return ["category_path", categoryPath];
}
