import HeaderMenu from "./header-menu/HeaderMenu";
import HeaderLocation from "./header-loc/HeaderLocation";
import styles from "./HeaderNavLayout.module.scss";

const HeaderNavLayout = () => {
  return (
    <div className={styles.header_container}>
      <HeaderMenu />
      <HeaderLocation />
    </div>
  );
};

export default HeaderNavLayout;
