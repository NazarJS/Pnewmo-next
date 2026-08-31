'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { useCatalogUrlState } from '@/entities/product/lib/useCatalogUrlState';

import styles from './Pagination.module.scss';

interface PaginationProps {
  total: number;
}

/**
 * page/limit идут из useCatalogUrlState — того же хука и того же парсера,
 * что использует ProductGrid для своего запроса. Раньше эти два числа
 * приходили пропсами с сервера, а usePathname/useSearchParams читались здесь
 * же по новой, для ссылок — два разных источника одного и того же состояния.
 * usePathname/useSearchParams ниже остаются: они строят href, а не
 * определяют текущую страницу.
 */
const Pagination = ({ total }: PaginationProps) => {
  const { page, limit } = useCatalogUrlState();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / limit));

  if (lastPage === 1) {
    return null;
  }

  const hrefFor = (target: number): string => {
    const params = new URLSearchParams(searchParams.toString());

    // Дефолт в адрес не пишем: первая страница остаётся чистым /catalog/slug.
    // Иначе два адреса с одинаковым содержимым — дубль для поисковика.
    if (target === 1) {
      params.delete('page');
    } else {
      params.set('page', String(target));
    }

    const query = params.toString();

    return query === '' ? pathname : `${pathname}?${query}`;
  };

  return (
    <nav className={styles.pagination} aria-label="Постраничная навигация">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={styles.link} rel="prev">
          Назад
        </Link>
      )}

      <span className={styles.status}>
        Страница {page} из {lastPage} · товаров {total}
      </span>

      {page < lastPage && (
        <Link href={hrefFor(page + 1)} className={styles.link} rel="next">
          Вперёд
        </Link>
      )}
    </nav>
  );
};

export default Pagination;
