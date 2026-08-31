import Image from "next/image";
import styles from "./HeaderFavorites.module.scss";
import CatalogButton from "@/widgets/header/ui/header-panel/header-catalog/ui/CatalogButton/CatalogButton";
import Heart from "@/shared/ui/icons/heart/Heart";
import Baskets from "@/shared/ui/icons/baskets/Baskets";
import Entrance from "@/shared/ui/icons/entrance/Entrance";
import type { HeaderFavoritesProps } from "../../../lib/types";

const HeaderFavorites = ({
  isMobileCatalogOpen,
  onCatalogClick,
}: HeaderFavoritesProps) => {
  return (
    <>
      <div className={`${styles.favorites_block} ${styles.hiddenOnMobile}`}>
        <Heart />
        <span className={styles.span}>Избраное</span>
      </div>
      <div className={styles.favorites_block}>
        <Baskets />
        <span className={styles.span}> Корзина</span>
      </div>
      <div className={styles.favorites_block}>
        <Entrance />
        <span className={styles.span}>Вход</span>
      </div>
      <div className={styles.mobile_catalog_container}>
        <CatalogButton isOpen={isMobileCatalogOpen} onClick={onCatalogClick} />
      </div>
    </>
  );
};

export default HeaderFavorites;
