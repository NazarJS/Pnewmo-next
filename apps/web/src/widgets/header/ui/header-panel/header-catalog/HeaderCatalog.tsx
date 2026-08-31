'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import HeaderInput from '../header-input/HeaderInput';
import styles from './HeaderCatalog.module.scss';

import { buildCategoryTree, findCategoryById, findRootCategoryIdBySlug } from '@/entities/category/lib/categoryTree';
import { useCategories } from '@/entities/category/api/hook';
import { useCategorySlugFromUrl } from '@/entities/category/hooks/useCategorySlugFromUrl';
import { useIsDesktop } from '@/shared/hooks/useIsDesktop';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';

import MegaMenu from './ui/MegaMenu/MegaMenu';
import CategoryItem from './ui/CategoryItem/CategoryItem';
import type { HeaderCatalogProps } from '../../../lib/types';

const HeaderCatalog = ({
  showSearch = true,
  isOpen,
  onClose,
  mobile = false,
}: HeaderCatalogProps) => {
  // Наведение мышью на десктопе — локальный UI-стейт (эталон прямо разрешает
  // useState именно для него). null означает «явного наведения ещё не было»:
  // тогда подсвечивается ветка текущей страницы каталога — см. catalogActive.
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);
  // Мобильная категория живёт только пока меню открыто: HeaderCatalog
  // монтируется в обоих местах (HeaderPanel.tsx) исключительно под
  // {isCatalogOpen && ...} / {isMobileCatalogOpen && ...}, значит isOpen у
  // живого инстанса всегда true — переход true→false его размонтирует, а не
  // меняет пропс на месте. Сброс на следующее открытие происходит сам, новым
  // useState(null) при повторном монтировании — эффект на смену isOpen здесь
  // никогда не сработал бы (см. отчёт задачи 3, п.4).
  const [mobileCategoryActive, setMobileCategoryActive] = useState<number | null>(null);

  const isDesktop = useIsDesktop();

  const { categories, loading, error } = useCategories();
  const categorySlug = useCategorySlugFromUrl();

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Корень ветки текущей страницы каталога — вычисляемое значение, не
  // эффект: раньше первая корневая категория проставлялась useEffect'ом уже
  // после монтирования, из-за чего на странице конкретной категории меню на
  // мгновение (а без соответствующего slug — навсегда) подсвечивало не её.
  //
  // Вне /catalog/[slug] (главная, страница товара) findRootCategoryIdBySlug
  // возвращает null — без фолбэка правая панель меню пустовала бы до первого
  // наведения мышью, а раньше (тем самым эффектом) она была заполнена сразу.
  // ?? categoryTree[0]?.id возвращает прежний вид: вне каталога подсвечена
  // первая корневая категория, на странице категории — её собственная ветка.
  const urlActiveRootId = useMemo(
    () => findRootCategoryIdBySlug(categories, categorySlug) ?? categoryTree[0]?.id ?? null,
    [categories, categorySlug, categoryTree],
  );

  // Наведение перекрывает URL, если оно было; до первого наведения (или на
  // странице, где никого не наводили) активна ветка текущего адреса.
  const catalogActive = hoveredCategoryId ?? urlActiveRootId;

  const activeCategory = useMemo(() => {
    if (catalogActive === null) {
      return null;
    }

    return findCategoryById(categoryTree, catalogActive);
  }, [catalogActive, categoryTree]);

  const handleClose = () => {
    setMobileCategoryActive(null);
    onClose?.();
  };

  useLockBodyScroll(isOpen);

  const toggleMobileCategory = (id: number) => {
    if (!mobile) {
      return;
    }

    setMobileCategoryActive((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <>
      {showSearch && (
        <div className={styles.search_wrapper}>
          <HeaderInput />
        </div>
      )}

      <div className={styles.catalog_container}>
        <div className={styles.sidebar}>
          <ul className={styles.categories_list}>
            {categoryTree.map((category) => {
              const categoryId = category.id;

              const isActive = mobile
                ? mobileCategoryActive === categoryId
                : catalogActive === categoryId;

              return (
                <CategoryItem
                  key={categoryId}
                  category={category}
                  isActive={isActive}
                  onMouseEnter={() => {
                    if (isDesktop) {
                      setHoveredCategoryId(categoryId);
                    }
                  }}
                  onClick={() => {
                    toggleMobileCategory(categoryId);
                  }}
                  onClose={handleClose}
                />
              );
            })}
          </ul>
        </div>

        {activeCategory && isDesktop && (
          <nav className={styles.mega_menu}>
            <div className={styles.mega_menu_content}>
              <h3 className={styles.categories_title}>
                <Link href={activeCategory.url} onClick={handleClose}>
                  {activeCategory.name}
                </Link>
              </h3>
              <MegaMenu category={activeCategory} onClose={handleClose} />
            </div>
          </nav>
        )}
      </div>
    </>
  );
};

export default HeaderCatalog;
