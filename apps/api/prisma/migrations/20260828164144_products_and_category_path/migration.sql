/*
  Warnings:

  - A unique constraint covering the columns `[path]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `path` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- Колонка добавляется допускающей NULL: в таблице уже есть строки, и NOT NULL
-- на непустой таблице без значения по умолчанию отвергается Postgres.
ALTER TABLE "categories" ADD COLUMN "path" TEXT;

-- Обратная засыпка рекурсивным обходом от корней вниз. Нужна не ради текущих
-- сорока мок-категорий (их всё равно заменит сид), а ради того, чтобы миграция
-- была корректна на любой базе — включая ту, где кто-то успел создать
-- категории через админку.
WITH RECURSIVE tree AS (
  SELECT id, parent_id, id::text AS path
  FROM "categories"
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, t.path || '.' || c.id::text
  FROM "categories" c
  JOIN tree t ON c.parent_id = t.id
)
UPDATE "categories" SET path = tree.path FROM tree WHERE "categories".id = tree.id;

ALTER TABLE "categories" ALTER COLUMN "path" SET NOT NULL;

CREATE UNIQUE INDEX "categories_path_key" ON "categories"("path");

-- Индекс под префиксный поиск. text_pattern_ops обязателен: без него btree по
-- text в русской локали не применяется к LIKE 'x.%', и выборка поддерева
-- превращается в seq scan по всей таблице.
CREATE INDEX "categories_path_prefix_idx" ON "categories" ("path" text_pattern_ops);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "external_id" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "ai_description" TEXT NOT NULL DEFAULT '',
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "specifications_full" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_external_id_key" ON "products"("external_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- GIN под будущие фасетные фильтры (этап 4c). Заводится сейчас, чтобы не
-- строить индекс на живой таблице в 4842 строки потом.
CREATE INDEX "products_specifications_idx" ON "products" USING GIN ("specifications");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
