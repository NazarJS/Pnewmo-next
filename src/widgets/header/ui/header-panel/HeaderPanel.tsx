"use client";

import styles from "./HeaderPanel.module.scss";
import Image from "next/image";
import HeaderCatalog from "./header-catalog/HeaderCatalog";
import HeaderInput from "./header-input/HeaderInput";
import HeaderAccordion from "./header-accordion/HeaderAccordion";
import HeaderFavorites from "./header-favorites/HeaderFavorites";

const HeaderPanel = () => {
  return (
    <main className={styles.header_catalog_main}>
      <div className={styles.header_catalog_block}>
        <Image
          src="/header-icons/Rectangle.svg"
          alt="Лого"
          width={200}
          height={40}
          style={{ width: "auto", height: "auto" }}
          loading="eager"
        />
        <div className={styles.desktop_catalog}>
          <HeaderCatalog />
        </div>
        <div className={styles.desktop_search}>
          <Image
            src="/header-icons/lupa.svg"
            alt="Лого"
            width={35}
            height={35}
            className={styles.imagePadding} 
            style={{ width: "35", height: "35" }}
          />
          <span className={styles.span_search}>Поиск</span>
          </div>
          <HeaderInput />
        
        <HeaderAccordion />

        <HeaderFavorites />
       
      </div>
    </main>
  );
};

export default HeaderPanel;
