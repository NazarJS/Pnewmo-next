import styles from '../header-loc/HeaderLocation.module.scss';
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
          style={{ width: 'auto', height: 'auto' }} 
        />
        <Image
          src="/header-icons/Label.svg"
          alt="График работы"
          width={150}
          height={20}
          style={{ width: 'auto', height: 'auto' }} 
        />
      </div>
      <div className={styles.header_locBlocks}>
        <Image
          src="/header-icons/Glyph2.svg"
          alt="Локация"
          width={20}
          height={20}
          style={{ width: 'auto', height: 'auto' }} 
        />
        <Image
          src="/header-icons/Label2.svg"
          alt="Город"
          width={150}
          height={20}
          style={{ width: 'auto', height: 'auto' }} 
        />
      </div>
    </div>
  );
};

export default HeaderLocation;
