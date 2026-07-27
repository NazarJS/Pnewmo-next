import { getProductId } from "@/entities/product/api/products.api";

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  const product = await getProductId(id);

  if (!product) {
    return <div>Товар не найден</div>;
  }

  return (
    <main>
      <h1>{product.title}</h1>

      <p>{product.description}</p>

      <h3>Характеристики</h3>

      <ul>
        {Object.entries(product.specifications).map(([key, value]) => (
          <li key={key}>
            {key}: {value}
          </li>
        ))}
      </ul>
    </main>
  );
}
