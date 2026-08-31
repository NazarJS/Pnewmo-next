'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import HeaderInput from '../header-input/HeaderInput';
import styles from './HeaderCatalog.module.scss';

import { buildCategoryTree, findCategoryById, findRootCategoryIdBySlug } from '@/entities/category/lib/categoryTree';
import { useCategories } from '@/entities/category/api/hook';
import { useCatalogUrlState } from '@/entities/product/lib/useCatalogUrlState';
import { useIsDesktop } from '@/shared/hooks/useIsDesktop';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';

import MegaMenu from './ui/MegaMenu/MegaMenu';
import CategoryItem from './ui/CategoryItem/CategoryItem';

interface HeaderCatalogProps {
  showSearch?: boolean;
  isOpen: boolean;
  onClose?: () => void;
  mobile?: boolean;
}

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
  const [mobileCategoryActive, setMobileCategoryActive] = useState<number | null>(null);
  // Только чтобы поймать переход isOpen → false и сбросить мобильную
  // категорию во время рендера, а не эффектом (см. комментарий ниже).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  const isDesktop = useIsDesktop();

  const { categories, loading, error } = useCategories();
  const { categorySlug } = useCatalogUrlState();

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Корень ветки текущей страницы каталога — вычисляемое значение, не
  // эффект: раньше первая корневая категория проставлялась useEffect'ом уже
  // после монтирования, из-за чего на странице конкретной категории меню на
  // мгновение (а без соответствующего slug — навсегда) подсвечивало не её.
  const urlActiveRootId = useMemo(
    () => findRootCategoryIdBySlug(categories, categorySlug),
    [categories, categorySlug],
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

  // Сброс мобильной категории при закрытии меню — во время рендера, а не в
  // useEffect: react-hooks/set-state-in-effect ругается именно на
  // синхронный setState в теле эффекта. Приём — официальный рецепт React
  // «adjusting state when a prop changes» без key: сравнить текущее и
  // предыдущее значение прямо в рендере. Вызывается безусловно на каждом
  // рендере, до любых ранних return ниже — иначе сравнение не увидит часть
  // переходов isOpen.
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);

    if (!isOpen) {
      setMobileCategoryActive(null);
    }
  }

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
