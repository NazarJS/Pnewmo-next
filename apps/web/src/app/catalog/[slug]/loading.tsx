import styles from './Loading.module.scss';

export default function Loading() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.spinner} aria-hidden="true" />
      <p>Загрузка каталога…</p>
    </div>
  );
}
