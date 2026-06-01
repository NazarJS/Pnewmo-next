"use client";

import React from "react";
import Link from "next/link";
import styles from "./HeaderMenu.module.scss";
const HeaderMenu = () => {
  return (
    <nav>
      <ul className={styles.header_menu}>
        <li>
          <Link href="/">О компании</Link>
        </li>
        <li>
          <Link href="/blog">Дилерский каталог</Link>
        </li>
        <li>
          <Link href="/projects">Наши проекты</Link>
        </li>
        <li>
          <Link href="/payment">Оплата</Link>
        </li>
        <li>
          <Link href="/delivery">Доставка</Link>
        </li>
        <li>
          <Link href="/contacts">Контакты</Link>
        </li>
      </ul>
    </nav>
  );
};

export default HeaderMenu;
