"use client";

import Link from "next/link";
import styles from "./HeaderMenu.module.scss";


const HeaderMenu = () => {
  return (
    <nav className={styles.header_nav}>
      <ul className={styles.header_nav_menu} >
        <li className={styles.header_nav_item}>
          <Link href="/">О компании</Link>
        </li>
        <li className={styles.header_nav_item}>
          <Link href="/blog">Дилерский каталог</Link>
        </li>
        <li className={styles.header_nav_item}>
          <Link href="/projects">Наши проекты</Link>
        </li>
        <li className={styles.header_nav_item}>
          <Link href="/payment">Оплата</Link>
        </li>
        <li className={styles.header_nav_item}>
          <Link href="/delivery">Доставка</Link>
        </li>
        <li className={styles.header_nav_item}>
          <Link href="/contacts">Контакты</Link>
        </li>
      </ul>
    </nav>
  );
};

export default HeaderMenu;
