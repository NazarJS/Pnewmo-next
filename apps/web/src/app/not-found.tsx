import Link from 'next/link';

import styles from './NotFound.module.scss';

/**
 * Обязательный файл App Router `not-found.tsx` — рендерится вместо
 * дефолтного английского экрана Next при notFound() (несуществующий слаг
 * категории, несуществующий id товара, страница за пределами выдачи,
 * нечисловой id — см. catalog/[slug]/page.tsx и product/[id]/page.tsx) и при
 * заходе на маршрут, которого нет вовсе. Код ответа Next проставляет сам
 * (404) — здесь только русский текст (правило заказчика №4): на
 * русскоязычной витрине англоязычный "This page could not be found" читается
 * как поломка.
 */
const NotFoundPage = () => {
  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Страница не найдена</h1>

      <p className={styles.text}>
        Такой страницы нет — возможно, адрес устарел или введён с ошибкой.
      </p>

      <Link href="/" className={styles.link}>
        На главную
      </Link>
    </div>
  );
};

export default NotFoundPage;
