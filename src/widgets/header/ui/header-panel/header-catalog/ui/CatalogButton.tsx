"use client";

import styles from "./CatalogButton.module.scss";

import Image from "next/image";
import Cross from "@/shared/ui/icons/cross/Cross";

interface onClickProps {
  isOpen: boolean;
  onClick?: () => void;
}

const CatalogButton = ({ isOpen, onClick }: onClickProps) => {
  return (
    <>
      <button onClick={onClick} className={styles.catalog_button} type="button">
        <div
          className={`${styles.icon_wrapper} ${isOpen ? styles.cross_open : styles.cross_closed}`}
        >
          <Cross />
        </div>
        <div
          className={`${styles.icon_wrapper} ${isOpen ? styles.burger_open : styles.burger_closed}`}
        >
          <Image
            src="/header-icons/Burger.svg"
            alt="Открыть каталог"
            width={28}
            height={28}
            style={{ width: "auto", height: "auto" }}
          />
          <span className={styles.span}>Каталог</span>
        </div>
      </button>
    </>
  );
};

export default CatalogButton;
