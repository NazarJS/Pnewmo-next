"use client";

import { useState, useEffect } from "react";
import HeaderInput from "../header-input/HeaderInput";
import styles from "./HeaderCatalog.module.scss";
import { Arrow } from "@/shared/ui/icons/arrow/Arrow";

interface HeaderCatalogProps {
  showSearch?: boolean;
  isOpen: boolean;
  onClick?: () => void;
}

const HeaderCatalog = ({showSearch = true, isOpen, onClick,}: HeaderCatalogProps) => {
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

  const [catalogActive, setCatalogActive] = useState<string | null>(null);


  useEffect(()=>{
    isOpen ? document.body.classList.add('no-scroll') : document.body.classList.remove('no-scroll');
    return ()=> {
      document.body.classList.remove('no-scroll');
    }
  }, [isOpen])

  useEffect(() => {
    if (window.innerWidth > 768) {
      setCatalogActive(data[0].id);
    }
  }, []);

  const toggleCategory = (id: string) => {
    if (window.innerWidth <= 768) {
      setCatalogActive((prev) => (prev === id ? null : id));
    }
  };

  const activeCategoryData = data.find((cat) => cat.id === catalogActive);

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
            {data.map((cat) => {
              const isActive = catalogActive === cat.id;
              return (
                <li
                  key={cat.id}
                  className={`${styles.category_item} ${catalogActive === cat.id ? styles.active : ""}`}
                  onMouseEnter={() => {
                    if (window.innerWidth > 768) setCatalogActive(cat.id);
                  }}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <div className={styles.category_header}>
                    <span>{cat.name}</span>
                    <div
                      className={` ${styles.active_arrow} ${isActive ? styles.active : ""} `}
                    >
                      <Arrow className={styles.arrow} />
                    </div>
                  </div>
                  <div
                    className={`${styles.mobile_accordion} ${isActive ? styles.accordion_open : ""}`}
                  >
                    <ul className={styles.mobile_subcategory_list}>
                      {cat.subcategories.map((sub) => (
                        <li
                          key={sub}
                          className={styles.mobile_subcategory_item}
                        >
                          {sub}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {activeCategoryData && (
          <nav className={styles.mega_menu}>
            <div className={styles.mega_menu_content}>
              <h3 className={styles.categories}>
                {activeCategoryData.catalogies}
              </h3>
              <ul className={styles.subcategory_grid}>
                {activeCategoryData.subcategories.map((sub) => (
                  <li key={sub} className={styles.subcategory_item}>
                    {sub}
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}
      </div>
    </>
  );
};

export default HeaderCatalog;
