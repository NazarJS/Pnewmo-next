import styles from "./HeaderCatalog.module.scss";
import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

interface onClickProps {
  onClick?: () => void;
}

const HeaderCatalog = ({ onClick }: onClickProps) => {
  return (
    <>
      <button onClick={onClick} className={styles.catalog_button} type="button">
        <Image
          src="/header-icons/Burger.svg"
          alt="Бургер"
          width={28}
          height={28}
          style={{ width: "auto", height: "auto" }}
        />
        <span className={styles.span}>Каталог</span>
      </button>
    </>
  );
};

export default HeaderCatalog;
