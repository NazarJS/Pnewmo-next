import HeaderCatalog from "./ui/header-panel/HeaderPanel";
import HeaderNavLayout from "./ui/header-nav/HeaderNavLayout";

import styles from "./Header.module.scss";

const Header = () => {
  return (
    <header className={styles.header_main}>
      <HeaderNavLayout />
      <HeaderCatalog />
    </header>
  );
};

export default Header;
