// "use client";

// import { useState, useEffect } from "react";
// import HeaderInput from "../header-input/HeaderInput";
// import styles from "./HeaderCatalog.module.scss";
// import { Arrow } from "@/shared/ui/icons/arrow/Arrow";

// interface HeaderCatalogProps {
//   showSearch?: boolean;
//   isOpen: boolean;
//   onClick?: () => void;
// }

// interface Category {
//   id: string;
//   parentId: string | null;
//   name: string;
//   url: string;
// }

// interface CategoryWithChildren extends Category {
//   children: CategoryWithChildren[];
// }

// const HeaderCatalog = ({ showSearch = true, isOpen, onClick }: HeaderCatalogProps) => {
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [catalogActive, setCatalogActive] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const fetchCategories = async () => {
//       try {
//         setLoading(true);
//         setError(null);
        
//         const response = await fetch("http://localhost:3001/categories");
        
//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`);
//         }
        
//         const data = await response.json();
//         // console.log("Fetched categories:", data);
//         setCategories(data);
        
//         if (data.length > 0 && window.innerWidth > 768) {
//           const rootCategory = data.find((cat: Category) => cat.parentId === null);
//           if (rootCategory) {
//             setCatalogActive(rootCategory.id);
//           }
//         }
//       } catch (error) {
//         // console.error("Error fetching categories:", error);
//         setError(error instanceof Error ? error.message : "Failed to load categories");
//         setCategories([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchCategories();
//   }, []);

//   useEffect(() => {
//     isOpen ? document.body.classList.add('no-scroll') : document.body.classList.remove('no-scroll');
//     return () => {
//       document.body.classList.remove('no-scroll');
//     };
//   }, [isOpen]);

//   // Функция для построения дерева категорий
//   const buildCategoryTree = (categories: Category[]): CategoryWithChildren[] => {
//     const categoryMap = new Map<string, CategoryWithChildren>();
//     const roots: CategoryWithChildren[] = [];

//     categories.forEach(cat => {
//       categoryMap.set(cat.id, { ...cat, children: [] });
//     });

//     categories.forEach(cat => {
//       const node = categoryMap.get(cat.id);
//       if (node) {
//         if (cat.parentId === null) {
//           roots.push(node);
//         } else {
//           const parent = categoryMap.get(cat.parentId);
//           if (parent) {
//             parent.children.push(node);
//           }
//         }
//       }
//     });

//     return roots;
//   };

//   const categoryTree = buildCategoryTree(categories);

//   const findCategoryById = (tree: CategoryWithChildren[], id: string): CategoryWithChildren | null => {
//     for (const cat of tree) {
//       if (cat.id === id) return cat;
//       const found = findCategoryById(cat.children, id);
//       if (found) return found;
//     }
//     return null;
//   };

//   const activeCategory = catalogActive ? findCategoryById(categoryTree, catalogActive) : null;

//   const toggleCategory = (id: string) => {
//     if (window.innerWidth <= 768) {
//       setCatalogActive((prev) => (prev === id ? null : id));
//     }
//   };

//   const renderSubcategories = (category: CategoryWithChildren, level: number = 0) => {
//     if (category.children.length === 0) return null;
    
//     return (
//       <ul className={styles.mobile_subcategory_list} style={{ paddingLeft: `${level * 10}px` }}>
//         {category.children.map((child) => (
//           <li key={child.id} className={styles.mobile_subcategory_item}>
//             <a href={child.url}>{child.name}</a>
//             {renderSubcategories(child, level + 1)}
//           </li>
//         ))}
//       </ul>
//     );
//   };

//   if (loading) {
//     return <div className={styles.loading}>Загрузка категорий...</div>;
//   }

//   if (error) {
//     return <div className={styles.error}>Ошибка: {error}</div>;
//   }

//   return (
//     <>
//       {showSearch && (
//         <div className={styles.search_wrapper}>
//           <HeaderInput />
//         </div>
//       )}
//       <div className={styles.catalog_container}>
//         <div className={styles.sidebar}>
//           <ul className={styles.categories_list}>
//             {categoryTree.map((cat) => {
//               const isActive = catalogActive === cat.id;
//               return (
//                 <li
//                   key={cat.id}
//                   className={`${styles.category_item} ${isActive ? styles.active : ""}`}
//                   onMouseEnter={() => {
//                     if (window.innerWidth > 768) setCatalogActive(cat.id);
//                   }}
//                   onClick={() => toggleCategory(cat.id)}
//                 >
//                   <div className={styles.category_header}>
//                     <a href={cat.url}>
//                       <span>{cat.name}</span>
//                     </a>
//                     {cat.children.length > 0 && (
//                       <div className={`${styles.active_arrow} ${isActive ? styles.active : ""}`}>
//                         <Arrow className={styles.arrow} />
//                       </div>
//                     )}
//                   </div>
//                   <div
//                     className={`${styles.mobile_accordion} ${isActive ? styles.accordion_open : ""}`}
//                   >
//                     {renderSubcategories(cat)}
//                   </div>
//                 </li>
//               );
//             })}
//           </ul>
//         </div>

//         {activeCategory && window.innerWidth > 768 && (
//           <nav className={styles.mega_menu}>
//             <div className={styles.mega_menu_content}>
//               <h3 className={styles.categories_title}>
//                 <a href={activeCategory.url}>{activeCategory.name}</a>
//               </h3>
              
//               {/* Отображаем подкатегории как заголовки с их вложенными подкатегориями */}
//               {activeCategory.children.length > 0 && (
//                 <div className={styles.subcategories_wrapper}>
//                   {activeCategory.children.map((childCategory) => (
//                     <div key={childCategory.id} className={styles.subcategory_group}>
//                       {/* Заголовок подкатегории */}
//                       <h4 className={styles.subcategory_title}>
//                         <a href={childCategory.url}>{childCategory.name}</a>
//                       </h4>
                      
//                       {/* Вложенные подкатегории */}
//                       {childCategory.children.length > 0 && (
//                         <ul className={styles.subcategory_grid}>
//                           {childCategory.children.map((subChild) => (
//                             <li key={subChild.id} className={styles.subcategory_item}>
//                               <a href={subChild.url}>{subChild.name}</a>
//                             </li>
//                           ))}
//                         </ul>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </nav>
//         )}
//       </div>
//     </>
//   );
// };

// export default HeaderCatalog;




"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import HeaderInput from "../header-input/HeaderInput";
import styles from "./HeaderCatalog.module.scss";
import { Arrow } from "@/shared/ui/icons/arrow/Arrow";

interface HeaderCatalogProps {
  showSearch?: boolean;
  isOpen: boolean;
  onClick?: () => void;
}

interface Category {
  id: string;
  parentId: string | null;
  name: string;
  url: string;
}

interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

const HeaderCatalog = ({
  showSearch = true,
  isOpen,
}: HeaderCatalogProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogActive, setCatalogActive] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDesktop, setIsDesktop] = useState(false);

  // определяем тип устройства
  useEffect(() => {
    const resize = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    resize();

    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, []);

  // загрузка категорий
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          "http://localhost:3001/categories"
        );

        if (!response.ok) {
          throw new Error("Ошибка загрузки категорий");
        }

        const data: Category[] = await response.json();

        setCategories(data);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Ошибка загрузки"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // первая активная категория
  useEffect(() => {
    if (!isDesktop || categories.length === 0) return;

    const root = categories.find((cat) => cat.parentId === null);

    if (root) {
      setCatalogActive(root.id);
    }
  }, [categories, isDesktop]);

  // запрет скролла
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

  // строим дерево
  const buildCategoryTree = (
    categories: Category[]
  ): CategoryWithChildren[] => {
    const map = new Map<string, CategoryWithChildren>();

    categories.forEach((category) => {
      map.set(category.id, {
        ...category,
        children: [],
      });
    });

    const roots: CategoryWithChildren[] = [];

    categories.forEach((category) => {
      const node = map.get(category.id)!;

      if (category.parentId === null) {
        roots.push(node);
        return;
      }

      const parent = map.get(category.parentId);

      if (parent) {
        parent.children.push(node);
      }
    });

    return roots;
  };

  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories);
  }, [categories]);

  const findCategoryById = (
    tree: CategoryWithChildren[],
    id: string
  ): CategoryWithChildren | null => {
    for (const category of tree) {
      if (category.id === id) return category;

      const child = findCategoryById(
        category.children,
        id
      );

      if (child) return child;
    }

    return null;
  };

  const activeCategory = useMemo(() => {
    if (!catalogActive) return null;

    return findCategoryById(
      categoryTree,
      catalogActive
    );
  }, [catalogActive, categoryTree]);

  const toggleCategory = (id: string) => {
    if (isDesktop) return;

    setCatalogActive((prev) =>
      prev === id ? null : id
    );
  };

  const renderSubcategories = (
    category: CategoryWithChildren,
    level = 1
  ) => {
    if (category.children.length === 0) return null;

    return (
      <ul
        className={styles.mobile_subcategory_list}
        // style={{
        //   paddingLeft: `${level * 16}px`,
        // }}
      >
        {category.children.map((child) => (
          <li
            key={child.id}
            className={styles.mobile_subcategory_item}
          >
            <Link href={child.url}>{child.name}</Link>

            {renderSubcategories(child, level + 1)}
          </li>
        ))}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        Загрузка...
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        {error}
      </div>
    );
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
              const isActive = catalogActive === category.id;

              return (
                <li
                  key={category.id}
                  className={`${styles.category_item} ${
                    isActive ? styles.active : ""
                  }`}
                  onMouseEnter={() => {
                    if (isDesktop) {
                      setCatalogActive(category.id);
                    }
                  }}
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className={styles.category_header}>
                    <Link href={category.url}>
                      <span>{category.name}</span>
                    </Link>

                    {category.children.length > 0 && (
                      <div
                        className={`${styles.active_arrow} ${
                          isActive ? styles.active : ""
                        }`}
                      >
                        <Arrow className={styles.arrow} />
                      </div>
                    )}
                  </div>

                  <div
                    className={`${styles.mobile_accordion} ${
                      isActive ? styles.accordion_open : ""
                    }`}
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
                <Link href={activeCategory.url}>
                  {activeCategory.name}
                </Link>
              </h3>

              {activeCategory.children.length > 0 && (
                <div className={styles.subcategories_wrapper}>
                  {activeCategory.children.map((childCategory) => (
                    <div
                      key={childCategory.id}
                      className={styles.subcategory_group}
                    >
                      <h4 className={styles.subcategory_title}>
                        <Link href={childCategory.url}>
                          {childCategory.name}
                        </Link>
                      </h4>

                      {childCategory.children.length > 0 && (
                        <ul className={styles.subcategory_grid}>
                          {childCategory.children.map((subChild) => (
                            <li
                              key={subChild.id}
                              className={styles.subcategory_item}
                            >
                              <Link href={subChild.url}>
                                {subChild.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </>
  );
};

export default HeaderCatalog;