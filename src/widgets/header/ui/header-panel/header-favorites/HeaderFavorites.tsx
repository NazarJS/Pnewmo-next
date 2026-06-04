import Image from "next/image";
import styles from './HeaderFavorites.module.scss'
import HeaderCatalog from "@/widgets/header/ui/header-panel/header-catalog/HeaderCatalog";


const HeaderFavorites = () => {
  return (
    <>
      <div className={styles.favorites_block}>
        <Image
          src="/header-icons/Heart.svg"
          alt="Heart"
          width={28}
          height={28}
          style={{width: '28', height: '30' }}
        />
        <span className={styles.span}>Избраное</span>
      </div>
      <div className={styles.favorites_block}>
        <Image
          src="/header-icons/Baskets.svg"
          alt="Baskets"
          width={28}
          height={28}
          style={{width: '28', height: '30' }}
        />
        <span className={styles.span}> Корзина</span>
      </div>
      <div className={styles.mobile_catalog}><HeaderCatalog/></div>
      <div className={styles.favorites_block}>
        <Image
          src="/header-icons/Entrance.svg"
          alt="Entrance"
          width={28}
          height={28}
          style={{width: '28', height: '30' }}
        />
        <span className={styles.span}>Вход</span>
      </div>
    </>
  );
};

export default HeaderFavorites;
