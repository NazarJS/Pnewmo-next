import HeaderMenu from "./header-menu/HeaderMenu";
import HeaderLocation from "./header-loc/HeaderLocation";
import styles from "./HeaderNavLayout.module.scss";

const HeaderNavLayout = () => {
  return (
    <div className={styles.header_top}>
      <div className='container'>
        <div className={styles.header_wrap}> 
            <HeaderMenu />
            <HeaderLocation />
        </div>
      </div>
    </div>
  );
};

export default HeaderNavLayout;
