"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import HeaderInput from "../header-input/HeaderInput";
import styles from "./HeaderCatalog.module.scss";

import { buildCategoryTree, findCategoryById } from "@/entities/category/lib/categoryTree";
import { useCategories } from "@/entities/category/hooks/useCategories";
import { useIsDesktop } from "@/shared/hooks/useIsDesktop";
import { useLockBodyScroll } from "@/shared/hooks/useLockBodyScroll";

import MegaMenu from "./ui/MegaMenu/MegaMenu";
import CategoryItem from "./ui/CategoryItem/CategoryItem";

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
  const [catalogActive, setCatalogActive] = useState<number | null>(null);
  const [mobileCategoryActive, setMobileCategoryActive] = useState<number | null>(null);

  const isDesktop = useIsDesktop();

  const {
    categories,
    loading,
    error,
  } = useCategories();

  const categoryTree = useMemo(
    () => buildCategoryTree(categories),
    [categories]
  );

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

  useEffect(() => {
    if (!isDesktop || categories.length === 0) {
      return;
    }

    const firstCategory = categories.find(
      (category) => category.parent_id === null
    );

    if (firstCategory && catalogActive === null) {
      setCatalogActive(firstCategory.id);
    }
  }, [categories, isDesktop, catalogActive]);

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setMobileCategoryActive(null);
    }
  }, [isOpen]);

  const toggleMobileCategory = (id: number) => {
    if (!mobile) {
      return;
    }

    setMobileCategoryActive((prev) =>
      prev === id ? null : id
    );
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
                      setCatalogActive(categoryId);
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
                <Link href={activeCategory.url}>
                  {activeCategory.name}
                </Link>
              </h3>

              <MegaMenu
                category={activeCategory}
                onClose={handleClose}
              />
            </div>
          </nav>
        )}
      </div>
    </>
  );
};

export default HeaderCatalog;