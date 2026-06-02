import styles from "../header-loc/HeaderLocation.module.scss";
import Image from "next/image";

const HeaderLocation = () => {
  return (
    <div className={styles.header_location}>
      <div className={styles.header_locBlocks}>
        <Image
          src="/header-icons/Glyph.svg"
          alt="Часы"
          width={20}
          height={20}
          style={{ width: "auto", height: "auto" }}
        />
        <p className={styles.p}>Пн - Пт: 9:00 - 18:00</p>
      </div>
      <div className={styles.header_locBlocks}>
        <Image
          src="/header-icons/Glyph2.svg"
          alt="Локация"
          width={20}
          height={20}
          style={{ width: "auto", height: "auto" }}
        />
        <p className={styles.p}>г. Гомель, ул. Базовая 6</p>
      </div>
    </div>
  );
};

export default HeaderLocation;
