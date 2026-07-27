import styles from "../header-loc/HeaderLocation.module.scss";
import Image from "next/image";

const HeaderLocation = () => {
  return (

    <div className={styles.header_info}>
      <div className={styles.header_info_wrap}>
        <Image
          className={styles.header_info_icon}
          src="/header-icons/Glyph.svg"
          alt="Часы"
          width={20}
          height={20}
        />
        <p className={styles.header_info_box}>Пн - Пт: 9:00 - 18:00</p>
      </div>
      <div className={styles.header_info_wrap}>
        <Image
          className={styles.header_info_icon}
          src="/header-icons/Glyph2.svg"
          alt="Локация"
          width={20}
          height={20}
        />
        <p className={styles.header_info_box}>г. Гомель, ул. Базовая 6</p>
      </div>
    </div>

  );
};

export default HeaderLocation;
