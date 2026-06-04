import HeaderMenu from "./header-menu/HeaderMenu";
import HeaderLocation from "./header-loc/HeaderLocation";
import styles from "./HeaderNavLayout.module.scss";

const HeaderNavLayout = () => {
  return (
    <div className={styles.header_container}>
      <div className={styles.header_nav_content}>
        <HeaderMenu />
        <HeaderLocation />
      </div>
    </div>
  );
};

export default HeaderNavLayout;
