import Link from "next/link";
import styles from "./Catalog.module.scss";

interface Category {
  id: string;
  parent_id: string | null;
  path: string;
  slug: string;
  name: string;
}

interface Product {
  id: string;
  title: string;
  description: string;
  category_id: number;
}


async function getCategories() {
  const response = await fetch(
    "http://localhost:3001/categories",
    {
      cache: "no-store",
    }
  );

  return response.json();
}


async function getProducts() {
  const response = await fetch(
    "http://localhost:3001/products",
    {
      cache: "no-store",
    }
  );

  return response.json();
}


// получаем все вложенные категории
function getChildCategoryIds(
  categories: Category[],
  parentId: string
): string[] {

  const ids = [parentId];


  categories.forEach((category) => {

    if (
      String(category.parent_id) === parentId
    ) {

      ids.push(
        ...getChildCategoryIds(
          categories,
          category.id
        )
      );

    }

  });


  return ids;
}


export default async function CatalogPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {


  const { slug } = await params;


  const categories =
    await getCategories();


  const category =
    categories.find(
      (item: Category) =>
        item.slug === slug
    );


  if (!category) {
    return (
      <h1>
        Категория не найдена
      </h1>
    );
  }


  const categoryIds =
    getChildCategoryIds(
      categories,
      category.id
    );


  console.log(
    "CATEGORY IDS:",
    categoryIds
  );


  const allProducts =
    await getProducts();


 const products =
  allProducts.filter(
    (product: Product) =>
      categoryIds.includes(
        String(product.category_id)
      )
  );


  console.log(
    "PRODUCTS:",
    products
  );


  return (
    <main>

      <h1>
        {category.name}
      </h1>


      {products.length === 0 && (
        <p>
          Товаров нет
        </p>
      )}


      <div className={styles.wrap}>

        {products.map(
          (product: Product) => (

            <Link
                key={product.id}
                href={`/product/${product.id}`}
                className={styles.item}
                >
                <h2>
                    {product.title}
                </h2>

                <p>
                    {product.description}
                </p>
            </Link>

          )
        )}

      </div>

    </main>
  );
}