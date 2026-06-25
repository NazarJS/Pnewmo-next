import HeaderMenu from "./header-menu/HeaderMenu";
import HeaderLocation from "./header-loc/HeaderLocation";
import styles from "./HeaderNavLayout.module.scss";

const HeaderNavLayout = () => {
  return (
    <div className={styles.header_container}>
      <div className={styles.header_nav_content}>
        <div className={styles.header_row_wrapper}>
          <div className={styles.header_row_1}>
            <HeaderMenu />
          </div>
          <div className={styles.header_row_2}>
            <HeaderLocation />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderNavLayout;
