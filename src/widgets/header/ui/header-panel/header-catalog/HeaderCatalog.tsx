"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import HeaderInput from "../header-input/HeaderInput";
import styles from "./HeaderCatalog.module.scss";
import { Arrow } from "@/shared/ui/icons/arrow/Arrow";
import { CategoryWithChildren } from "@/entities/category/model/types";
import { buildCategoryTree, findCategoryById } from "@/entities/category/lib/categoryTree";
import { useCategories } from "@/entities/category/hooks/useCategories";
import { useIsDesktop } from "@/shared/hooks/useIsDesktop";

interface HeaderCatalogProps {
  showSearch?: boolean;
  isOpen: boolean;
  onClose?: () => void;
}

const HeaderCatalog = ({ showSearch = true, isOpen, onClose }: HeaderCatalogProps) => {
  const [catalogActive, setCatalogActive] = useState<number | null>(null);
  const [openMobileCategories, setMobileCategories] = useState<Set<number>>(new Set());
  const isDesktop = useIsDesktop();

  const {
    categories,
    loading,
    error,
  } = useCategories();

  // первая категория для desktop
  useEffect(() => {
    if (!isDesktop || categories.length === 0) {
      return;
    }

    const root = categories.find((category) => category.parent_id === null);

    if (root) {
      setCatalogActive(root.id);
    }
  }, [categories, isDesktop]);

  // блокировка скролла
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isOpen]);

  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories);
  }, [categories]);

  const activeCategory = useMemo(() => {
    if (catalogActive === null) {
      return null;
    }

    return findCategoryById(categoryTree, catalogActive);
  }, [catalogActive, categoryTree]);

  const toggleCategory = (id: number) => {
    if (isDesktop) {
      return;
    }

    setCatalogActive((prev) => (prev === id ? null : id));
  };

  // на мобилке когда ты открываешь один каталог и если ты решишь открыть другой то у тебя не закрывается предыдущий
  const toggleMobileCategory = (id: number) => {
    if (window.innerWidth <= 1024) {
      setMobileCategories((prev) => {
        if (prev.has(id)) {
          return new Set();
        }

        return new Set([id]);
      });
    }
  };

  // mobile дерево
  const renderSubcategories = (category: CategoryWithChildren) => {
    if (category.children.length === 0) {
      return null;
    }

    return (
      <ul className={styles.mobile_subcategory_list}>
        {category.children.map((child) => (
          <li key={child.id} className={styles.mobile_subcategory_item}>
            <Link href={child.url} onClick={onClose}>
              {child.name}
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  // mega menu
  const renderMegaMenu = (category: CategoryWithChildren) => {
    return (
      <div className={styles.subcategories_wrapper}>
        {category.children.map((subcategory) => (
          <div key={subcategory.id} className={styles.subcategory_group}>
            <h4 className={styles.subcategory_title}>
              <Link href={subcategory.url} onClick={onClose}>
                {subcategory.name}
              </Link>
            </h4>

            {subcategory.children.length > 0 && (
              <ul className={styles.subcategory_grid}>
                {subcategory.children.map((child) => (
                  <li key={child.id} className={styles.subcategory_item}>
                    <Link href={child.url} onClick={onClose}>
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
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
              const isActive = isDesktop ? catalogActive === category.id : openMobileCategories.has(category.id);

              return (
                <li
                  key={category.id}
                  className={`${styles.category_item} ${isActive ? styles.active : ""}`}
                  onMouseEnter={() => {
                    if (window.innerWidth > 1024) {
                      setCatalogActive(category.id);
                    }
                  }}
                  onClick={() => toggleMobileCategory(category.id)}
                >
                  <div className={styles.category_header}>
                    <Link href={category.url} onClick={onClose}>
                      <span>{category.name}</span>
                    </Link>

                    {category.children.length > 0 && (
                      <div className={`${styles.active_arrow} ${isActive ? styles.active : ""}`}>
                        <Arrow className={styles.arrow} />
                      </div>
                    )}
                  </div>

                  <div
                    className={`${styles.mobile_accordion} ${isActive ? styles.accordion_open : ""}`}
                  >
                    {renderSubcategories(category)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {activeCategory && isDesktop && (
          <nav className={styles.mega_menu}>
            <div className={styles.mega_menu_content}>
              <h3 className={styles.categories_title}>
                <Link href={activeCategory.url}>{activeCategory.name}</Link>
              </h3>

              {renderMegaMenu(activeCategory)}
            </div>
          </nav>
        )}
      </div>
    </>
  );
};

export default HeaderCatalog;