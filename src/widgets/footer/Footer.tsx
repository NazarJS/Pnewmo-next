import React from 'react'
import styles from "./Footer.module.scss";
import Link from "next/link";
import FooterBottom from './ui/footer-bottom/FooterBottom';
import SocialIcon from './ui/social-icons/SocialIcon';

const Footer = () => {
  return (
    <footer className={styles.footer}>
        <div className="container">
            <div className={styles.content}>
                <div className={styles.column}>
                    <h3 className={styles.heading}>О нас</h3>

                    <ul className={styles.list}>
                        <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                О компании
                            </Link>
                        </li>

                        <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Наши проекты
                            </Link>
                        </li>
                    </ul>

                    <SocialIcon/>
                </div>

                <div className={styles.column}>
                    <h3 className={styles.heading}>Покупателям</h3>

                    <ul className={styles.list}>
                        <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Как оформить заказ?
                            </Link>
                        </li>

                        <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Оплата
                            </Link>
                        </li>

                         <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Доставка
                            </Link>
                        </li>

                         <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Обмен, возврат, гарантия
                            </Link>
                        </li>
                    </ul>
                </div>

                <div className={styles.column}>
                    <h3 className={styles.heading}>Каталог</h3>

                    <ul className={styles.list}>
                        <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Гидравлика
                            </Link>
                        </li>

                        <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Пневматика
                            </Link>
                        </li>

                         <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Смазочная техника
                            </Link>
                        </li>

                         <li className={styles.listItem}>
                            <Link href="/" className={styles.link}>
                                Системы линейных перемещений
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className={styles.column}>
                    <h3 className={styles.heading}>Контакты</h3>
                    
                   <div className={styles.contactBlock}>
                    <span className={styles.label}>
                        Телефоны:
                    </span>
                        <a  href="tel:+375232214222" className={styles.contactItem}>+375 (232)214-222</a>
                        <a  href="tel:+375232214222" className={styles.contactItem}>+375 (232)214-222</a>
                   </div>

                   <div className={styles.contactBlock}>
                     <span className={styles.label}>
                        Email:
                    </span>
                        <a href="mailto:info@pneumo-center.by" className={styles.contactItem}>
                            info@pneumo-center.by
                        </a>
                   </div>

                   <div className={styles.contactBlock}>
                        <span className={styles.label}>
                            Время работы:
                        </span>
                        <span className={styles.contactItem}>Пн - Пт: 9:00 - 17:30</span>
                   </div>

                   <div className={styles.contactBlock}>
                        <span className={styles.label}>
                            Адрес:
                        </span>
                        <span className={styles.contactItem}>г. Гомель, ул. Базовая 6</span>
                   </div>
                </div>
            </div>
        </div>

        <FooterBottom/>
    </footer>
  )
}

export default Footer