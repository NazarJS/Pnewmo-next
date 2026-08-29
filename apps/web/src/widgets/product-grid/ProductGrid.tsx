'use client';

import { useProductList } from '@/entities/product/api/productHook';
import type { Product } from '@/entities/product/lib/productTypes';

import styles from './ProductGrid.module.scss';
import Pagination from './ui/Pagination/Pagination';
import ProductCard from './ui/ProductCard/ProductCard';

interface ProductGridProps {
  categoryId: number;
  page: number;
  offset: number;
  limit: number;
}

/**
 * Клиентский компонент, но за данными он не ходит: их положил в кэш серверный
 * префетч под тем же ключом. useQuery здесь читает готовое — и берёт на себя
 * последующие переходы по страницам без полной перезагрузки.
 */
const ProductGrid = ({ categoryId, page, offset, limit }: ProductGridProps) => {
  const { data, isPending } = useProductList({ categoryId, offset, limit });

  if (isPending) {
    return <p>Загрузка...</p>;
  }

  if (data?.status !== 200) {
    return <p>Не удалось загрузить товары</p>;
  }

  const { items, total } = data.body;

  if (total === 0) {
    return <p>В этой категории пока нет товаров</p>;
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <Pagination page={page} limit={limit} total={total} />
    </>
  );
};

export default ProductGrid;
