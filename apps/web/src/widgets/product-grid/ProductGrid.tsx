'use client';

import { useProductList } from '@/entities/product/api/hook';
import { useCatalogUrlState } from '@/entities/product/hooks/useCatalogUrlState';

import { deriveProductGridState } from './lib/deriveProductGridState';
import type { ProductGridProps } from './lib/types';
import styles from './ProductGrid.module.scss';
import Pagination from './ui/Pagination/Pagination';
import ProductCard from './ui/ProductCard/ProductCard';

/**
 * Клиентский компонент, но за данными он не ходит: их положил в кэш серверный
 * префетч под тем же ключом. useQuery здесь читает готовое — и берёт на себя
 * последующие переходы по страницам без полной перезагрузки.
 *
 * offset/limit идут из useCatalogUrlState, а не пропсами с сервера: тот же
 * парсер, что резолвит серверная страница для префетча, поэтому ключ запроса
 * гарантированно совпадает и гидрация не уходит за данными повторно.
 */
const ProductGrid = ({ categoryId }: ProductGridProps) => {
  const { offset, limit } = useCatalogUrlState();
  const query = useProductList({ categoryId, offset, limit });

  // Одна деривация вместо трёх ранних return: загрузка/ошибка/пустая
  // категория рисуются внутри тела компонента, а не обрывают его рендер.
  // data уже сужена деривацией до { items, total } — компонент не решает
  // data?.status === 200 второй раз поверх уже готового message.
  const { message, data } = deriveProductGridState(query);

  return (
    <>
      {message && <p>{message}</p>}

      {data && (
        <>
          <div className={styles.grid}>
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination total={data.total} />
        </>
      )}
    </>
  );
};

export default ProductGrid;
