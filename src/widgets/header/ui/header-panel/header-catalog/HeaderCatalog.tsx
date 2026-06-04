import styles from "./HeaderCatalog.module.scss";
import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const HeaderCatalog = () => {
  return (
    <>
      <button className={styles.catalog_button} type="button">
        <Image
          src="/header-icons/Burger.svg"
          alt="Бургер"
          width={28}
          height={28}
          style={{ width: 'auto', height: 'auto' }} 
        />
        <span className={styles.span}>Каталог</span>
      </button>
    </>
  );
};

export default HeaderCatalog;
