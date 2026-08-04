import Link from "next/link";
import styles from "./Catalog.module.scss";
import {fetchCategories} from "@/entities/category/api/category.api";
import { getProducts } from "@/entities/product/api/products.api";
import getChildCategoryIds from "@/entities/category/lib/getChildCategoryIds";
import { Product } from "@/entities/product/model/types";
import {Category} from "@/entities/category/model/types";

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [rawCategories, rawProducts] = await Promise.all([fetchCategories(), getProducts()]);

  const categories = rawCategories ?? [];

  const category = categories.find((item: Category) => item.slug === slug);

  if (!category) {
    return <h1>Категория не найдена</h1>;
  }

  const categoryIds = getChildCategoryIds(categories, category.id);

  const allProducts = rawProducts ?? [];
  const productsList = allProducts ?? [];


  const products = productsList.filter((product: Product) =>
    categoryIds.includes(product.category_id)
  );

  return (
    <>
      <h1 className={styles.name}>{category.name}</h1>

      {products.length === 0 && <p>Товаров нет</p>}

      <div className={styles.wrap}>
        {products.map((product: Product) => (
          <Link key={product.id} href={`/product/${product.id}`} className={styles.item}>
            <h2>{product.title}</h2>

            <p>{product.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
