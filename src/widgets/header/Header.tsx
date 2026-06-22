import HeaderCatalogPanel from "./ui/header-panel/HeaderCatalogPanel";
import HeaderNavLayout from "./ui/header-nav/HeaderNavLayout";

import styles from "./Header.module.scss";

const Header = () => {
  return (
    <>
    <header className={styles.header_main}>
      <HeaderNavLayout />
      <HeaderCatalogPanel />
    </header>
    </>
  );
};

export default Header;
