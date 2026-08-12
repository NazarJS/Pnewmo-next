import styles from "../header-loc/HeaderLocation.module.scss";
import Image from "next/image";
import Watch from "@/shared/ui/icons/watch/Watch"
import Location from "@/shared/ui/icons/loc/Location"

const HeaderLocation = () => {
  return (

    <div className={styles.header_info}>
      <div className={styles.header_info_wrap}>
        <Watch
          className={styles.header_info_icon}
        />
        <p className={styles.header_info_box}>Пн - Пт: 9:00 - 18:00</p>
      </div>
      <div className={styles.header_info_wrap}>
        <Location
          className={styles.header_info_icon}
        />
        <p className={styles.header_info_box}>г. Гомель, ул. Базовая 6</p>
      </div>
    </div>

  );
};

export default HeaderLocation;
