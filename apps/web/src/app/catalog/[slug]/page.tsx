import Link from 'next/link';
import styles from './Catalog.module.scss';
import { fetchCategories } from '@/entities/category/api/category.api';
import {
  getCategoryFilterSchema,
  getFilteredProducts,
  getFilterFieldCounts,
} from '@/entities/product/api/products.api';
import { parseFiltersFromSearchParams } from '@/features/product-filter/model/parseFiltersFromSearchParams';
import { Category } from '@/entities/category/model/types';
import ProductFilterPanel from '@/features/product-filter/ui/ProductFilterPanel';

interface CatalogPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;

  const rawCategories = await fetchCategories();
  const categories = rawCategories ?? [];

  const category = categories.find((item: Category) => item.slug === slug);

  if (!category) {
    return <h1>Категория не найдена</h1>;
  }

  const schema = (await getCategoryFilterSchema(category.path)) ?? [];
  const filters = parseFiltersFromSearchParams(rawSearchParams, schema);
  const enumFields = schema.filter((field) => field.type === 'enum');

  const [rawProducts, countsList] = await Promise.all([
    getFilteredProducts(category.path, filters),
    Promise.all(enumFields.map((field) => getFilterFieldCounts(category.path, filters, field))),
  ]);

  const products = rawProducts ?? [];

  const counts: Record<string, Record<string, number> | null> = {};
  enumFields.forEach((field, index) => {
    counts[field.key] = countsList[index];
  });

  return (
    <div className={styles.container_page}>
      
      <div className={styles.panel_container}>
        <ProductFilterPanel schema={schema} counts={counts} activeFilters={filters} />
      </div>
      
      {products.length === 0 && <p>Товаров нет</p>}

      <section className={styles.section}>
        <h1 className={styles.name}>{category.name}</h1>
      <div className={styles.wrap}>
        {products.map((product) => (
          <Link key={product.id} href={`/product/${product.id}`} className={styles.item}>
            <h2>{product.title}</h2>

            <p>{product.description}</p>
          </Link>
        ))}
      </div>
      </section>
    </div>
  );
}
