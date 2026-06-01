"use client";

import styles from "./HeaderPanel.module.scss";
import Image from "next/image";
import HeaderCatalog from "./header-catalog/HeaderCatalog";
import HeaderInput from "./header-input/HeaderInput";
import HeaderAccordion from './header-accordion/HeaderAccordion'
import HeaderFavorites from './header-favorites/HeaderFavorites'

const HeaderPanel = () => {
  return (
    <main className={styles.header_catalog_main}>
      <div className={styles.header_catalog_block}>
        <Image
          src="/header-icons/Rectangle.svg"
          alt="Лого"
          width={200}
          height={40}
          style={{ width: 'auto', height: 'auto' }} 
          loading="eager"
        />
        <HeaderCatalog />
        <HeaderInput />
        <HeaderAccordion/>
        <HeaderFavorites/>
      </div>
    </main>
  );
};

export default HeaderPanel;
