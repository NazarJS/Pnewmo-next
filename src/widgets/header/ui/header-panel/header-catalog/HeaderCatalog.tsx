"use client";

import { useState } from "react";
import HeaderInput from "../header-input/HeaderInput";
import styles from "./HeaderCatalog.module.scss";

interface HeaderCatalogProps {
  showSearch?: boolean;
  isOpen: boolean;
  onClick?: () => void;
}

const HeaderCatalog = ({
  showSearch = true,
  isOpen,
  onClick,
}: HeaderCatalogProps) => {
  const [catalogActive, setCatalogActive] = useState<string | null>(null);

  const data = [
    {
      id: "electronics",
      name: "Электроника",
      subcategories: ["Смартфоны", "Ноутбуки", "Наушники"],
    },
    {
      id: "home",
      name: "Для дома",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
    {
      id: "piski",
      name: "Письки",
      subcategories: ["Смартфоны", "Ноутбуки", "Наушники"],
    },
    {
      id: "popki",
      name: "Попки",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
    {
      id: "kaki",
      name: "Какашечки",
      subcategories: ["Смартфоны", "Ноутбуки", "Наушники"],
    },
    {
      id: "pisia",
      name: "Писечки",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
    {
      id: "siski",
      name: "Сисечки",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
  ];

  const activeCategoryData = data.find((cat) => cat.id === catalogActive);

  return (
    <main className={styles.main_container}>
      {showSearch && (
        <div className={styles.search_wrapper}>
          <HeaderInput />
        </div>
      )}
      <div
        className={styles.catalog_container}
        onMouseLeave={() => setCatalogActive(null)}
      >
        <nav className={styles.sidebar}>
          <ul className={styles.categories_list}>
            {data.map((cat) => (
              <li
                key={cat.id}
                className={`${styles.category_item} ${catalogActive === cat.id ? styles.active : ""}`}
                onMouseEnter={() => setCatalogActive(cat.id)}
              >
                <span>{cat.name}</span>
                {catalogActive === cat.id && (
                  <div className={styles.active_arrow}></div>
                )}
              </li>
            ))}
          </ul>
        </nav>
        {activeCategoryData && (
          <nav className={styles.mega_menu}>
            <ul className={styles.subcategory_grid}>
              {activeCategoryData.subcategories.map((sub) => (
                <li key={sub} className={styles.subcategory_item}>
                  {sub}
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </main>
  );
};

export default HeaderCatalog;
