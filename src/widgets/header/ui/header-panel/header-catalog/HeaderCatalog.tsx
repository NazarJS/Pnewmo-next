"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import HeaderInput from "../header-input/HeaderInput";
import styles from "./HeaderCatalog.module.scss";
import { Arrow } from "@/shared/ui/icons/arrow/Arrow";

interface HeaderCatalogProps {
  showSearch?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

interface Category {
  id: number;
  parent_id: number | null;
  path: string;
  slug: string;
  name: string;
  url: string;
}

interface CategoryDTO {
  id: string | number;
  parent_id: string | number | null;
  path: string;
  slug: string;
  name: string;
  url: string;
}

interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

const HeaderCatalog = ({ showSearch = true, isOpen, onClose }: HeaderCatalogProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogActive, setCatalogActive] = useState<number | null>(null);
  const [openMobileCategories, setMobileCategories] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);


    // Получение категорий
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);

        const response = await fetch("http://localhost:3001/categories");

        if (!response.ok) {
          throw new Error("Ошибка загрузки категорий");
        }

        const data: CategoryDTO[] = await response.json();

        const categoriesWithUrl: Category[] = data.map((category) => ({
          id: Number(category.id),
          parent_id: category.parent_id === null ? null : Number(category.parent_id),
          path: category.path,
          slug: category.slug,
          name: category.name,
          url: `/catalog/${category.slug}`,
        }));

        setCategories(categoriesWithUrl);

        if (categoriesWithUrl.length > 0 && window.innerWidth > 1024){
          setCatalogActive(categoriesWithUrl[0].id)
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);


  const toggleMobileCategory = (id: number) => {
    if (window.innerWidth <= 1024) {
      setMobileCategories((prev) => {
        const nextCat = new Set(prev);
        nextCat.has(id) ? nextCat.delete(id) : nextCat.add(id);
        return nextCat;
      });

    const resize = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  
  }
}



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

  // построение дерева
  const buildCategoryTree = (categories: Category[]): CategoryWithChildren[] => {
    const map = new Map<number, CategoryWithChildren>();

    categories.forEach((category) => {
      map.set(category.id, {
        ...category,
        children: [],
      });
    });

    const roots: CategoryWithChildren[] = [];

    categories.forEach((category) => {
      const node = map.get(category.id)!;

      if (category.parent_id === null) {
        roots.push(node);
        return;
      }

      const parent = map.get(category.parent_id);

      if (parent) {
        parent.children.push(node);
      }
    });

    return roots;
  };

  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories);
  }, [categories]);

  // поиск категории
  const findCategoryById = (tree: CategoryWithChildren[], id: number): CategoryWithChildren | null => {
    for (const category of tree) {
      if (category.id === id) {
        return category;
      }

      const child = findCategoryById(category.children, id);

      if (child) {
        return child;
      }
    }

    return null;
  };

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

  // mobile дерево
  const renderSubcategories = (category: CategoryWithChildren) => {
    if (category.children.length === 0) {
      return null;
    }

    return (
      <ul className={styles.mobile_subcategory_list}>
        {category.children.map((child) => (
          <li key={child.id} className={styles.mobile_subcategory_item}>
            <Link href={child.url} onClick={onClose}>{child.name}</Link>
            {renderSubcategories(child)}
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
              <Link href={subcategory.url} onClick={onClose}>{subcategory.name}</Link>
            </h4>

            {subcategory.children.length > 0 && (
              <ul className={styles.subcategory_grid}>
                {subcategory.children.map((child) => (
                  <li key={child.id} className={styles.subcategory_item}>
                    <Link href={child.url} onClick={onClose}>{child.name}</Link>
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
              const isActive = catalogActive === category.id || openMobileCategories.has(category.id);
              return (
                <li
                  key={category.id}
                  className={`${styles.category_item} ${isActive ? styles.active : ""}`}
                  onMouseEnter={() => {
                    if (isDesktop) {
                      setCatalogActive(category.id);
                    }

                  }}
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className={styles.category_header}>

                    <span>{category.name}</span>
                    <div
                      className={` ${styles.active_arrow} ${isActive ? styles.active : ""} `}
                    >
                      <Arrow className={styles.arrow} />
                    </div>

                    <Link href={category.url} onClick={onClose}>
                      <span>{category.name}</span>
                    </Link>

                    {category.children.length > 0 && (
                      <div className={`${styles.active_arrow} ${isActive ? styles.active : ""}`}>
                        <Arrow className={styles.arrow} />
                      </div>
                    )}

                  </div>

                  <div className={`${styles.mobile_accordion} ${isActive ? styles.accordion_open : ""}`}>
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
export default HeaderCatalog