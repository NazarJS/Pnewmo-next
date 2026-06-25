import styles from "../header-loc/HeaderLocation.module.scss";
import Image from "next/image";

const HeaderLocation = () => {
  return (

    <div className={styles.header_menu}>
      <div className={styles.header_menu_time}>
        <div className={styles.header_menu_icon}>
        <Image
          src="/header-icons/Glyph.svg"
          alt="Часы"
          width={20}
          height={20}
          style={{ width: "auto", height: "auto" }}
        />
        </div>
        <p className={styles.p}>Пн - Пт: 9:00 - 18:00</p>
      </div>
      <div className={styles.header_meu_address}>
        <div className={styles.header_menu_icon}>
        <Image
          src="/header-icons/Glyph2.svg"
          alt="Локация"
          width={20}
          height={20}
          style={{ width: "auto", height: "auto" }}
        />
        </div>
        <p className={styles.p}>г. Гомель, ул. Базовая 6</p>
      </div>
    </div>

  );
};

export default HeaderLocation;
