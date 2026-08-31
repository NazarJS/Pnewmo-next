"use client";

import styles from "./CatalogButton.module.scss";
import type { CatalogButtonProps } from "../../../../../lib/types";

const CatalogButton = ({ isOpen, onClick }: CatalogButtonProps) => {
  return (
    <>
      <button onClick={onClick} className={styles.catalog_button} type="button">
        <div className={`${styles.burger} ${isOpen ? styles.active : ""}`}>
        </div>
        
        <span className={styles.span}>Каталог</span>
        
      </button>
    </>
  );
};

export default CatalogButton;
