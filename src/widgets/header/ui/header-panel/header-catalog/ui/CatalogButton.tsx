"use client";

import styles from "./CatalogButton.module.scss";



interface onClickProps {
  isOpen: boolean;
  onClick?: () => void;
}

const CatalogButton = ({ isOpen, onClick }: onClickProps) => {
  return (
    <>
      <button onClick={onClick} className={styles.catalog_button} type="button">
        <div
          className={`${styles.burger} ${isOpen ? styles.active : ""}`}
        >
          <span></span>
        </div>
        <div>
          <span className={styles.span}>Каталог</span>
        </div>
      </button>
    </>
  );
};

export default CatalogButton;
