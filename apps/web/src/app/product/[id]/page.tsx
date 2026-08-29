import Image from 'next/image';
import { notFound } from 'next/navigation';

import { formatPrice } from '@/entities/product/lib/formatPrice';
import { api } from '@/shared/api/client';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound();
  }

  const response = await api.products.getById({ params: { id: numericId } });

  if (response.status !== 200) {
    notFound();
  }

  const product = response.body;
  const specifications = Object.entries(product.specifications);

  return (
    <article>
      <h1>{product.name}</h1>

      <Image src={product.imageUrl} alt={product.name} width={282} height={148} sizes="282px" />

      <p>{formatPrice(product.price)}</p>

      {specifications.length > 0 && (
        <table>
          <tbody>
            {specifications.map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
