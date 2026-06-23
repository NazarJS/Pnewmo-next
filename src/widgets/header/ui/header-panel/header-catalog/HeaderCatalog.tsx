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
  const data = [
    {
      id: "electronics",
      name: "Электроника",
      catalogies: "Все для Электроники",
      subcategories: ["Смартфоны", "Ноутбуки", "Наушники"],
    },
    {
      id: "home",
      name: "Для дома",
      catalogies: "Все для Дома",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
    {
      id: "piski",
      name: "Письки",
      catalogies: "Все для Письки",
      subcategories: ["Смартфоны", "Ноутбуки", "Наушники"],
    },
    {
      id: "popki",
      name: "Попки",
      catalogies: "Все для Попки",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
    {
      id: "kaki",
      name: "Какашечки",
      catalogies: "Все для ",
      subcategories: ["Смартфоны", "Ноутбуки", "Наушники"],
    },
    {
      id: "pisia",
      name: "Писечки",
      catalogies: "Все для Писечки",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
    {
      id: "siski",
      name: "Сисечки",
      catalogies: "Все для Сисечки",
      subcategories: ["Мебель", "Свет", "Декор"],
    },
  ];

  const [catalogActive, setCatalogActive] = useState<string >(data[0].id);

  const activeCategoryData = data.find((cat) => cat.id === catalogActive);

  return (
  
    <div className={styles.main_container}>
      {showSearch && (
        <div className={styles.search_wrapper}>
          <HeaderInput />
        </div>
      )}
      <div
        className={styles.catalog_container}
        
      >
        <div className={styles.sidebar}>
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
        </div>
        {activeCategoryData && (
          <nav className={styles.mega_menu}>
            <h3 className={styles.categories}>{activeCategoryData.catalogies}</h3>
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
    </div>

  );
};

export default HeaderCatalog;
