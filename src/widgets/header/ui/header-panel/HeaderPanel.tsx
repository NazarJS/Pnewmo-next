"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./HeaderPanel.module.scss";
import Image from "next/image";
import CatalogButton from "./header-catalog/ui/CatalogButton";
import HeaderInput from "./header-input/HeaderInput";
import HeaderAccordion from "./header-accordion/HeaderAccordion";
import HeaderFavorites from "./header-favorites/HeaderFavorites";
import HeaderCatalog from "@/widgets/header/ui/header-panel/header-catalog/HeaderCatalog";
import { useOpenInput } from "./hooks/useOpenInput";
import Loupe from "@/shared/ui/icons/loupe/Loupe";

const HeaderCatalogPanel = () => {
  const {
    isSearchOpen,
    isCatalogOpen,
    isMobileCatalogOpen,
    closeAll,
    togglePanel,
  } = useOpenInput();
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
      if (window.innerWidth > 1024) {
        closeAll();
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [closeAll]);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  return (
    <div className="container">
      <div className={`${styles.header_panel_main}`}>
        <div className={`${styles.header_panel_features}${isSearchOpen ? "" : ""}`}>
          <div className={styles.header_panel_logo}>
            <Image
              src="/header-icons/Rectangle.svg"
              alt="Лого"
              width={200}
              height={40}
              style={{ width: "auto", height: "auto" }}
              loading="eager"
            />
          </div>
          <div className={styles.desktop_catalog_button}>
            <CatalogButton
              isOpen={isCatalogOpen}
              onClick={() => togglePanel("catalog")}
            />
          </div>
          <div className={styles.desktop_input}>
            <HeaderInput ref={inputRef} />
          </div>
          <div className={styles.header_mobile_favorites_main}>
            <div className={styles.mobile_input_search}>
              <button onClick={() => togglePanel("search")}>
                <Loupe className={styles.loupe}/>
                <span className={styles.span_input_search}>Поиск</span>
              </button>
            </div>
           
            <HeaderAccordion />
            
            <div className={styles.header_desktop_favorites_main}>
              <HeaderFavorites
                isMobileCatalogOpen={isMobileCatalogOpen}
                onCatalogClick={() => togglePanel("mobileCatalog")}
              />
            </div>
          </div>
        </div>
        {isCatalogOpen && (
              <div className={styles.container_catalog}>
                <HeaderCatalog isOpen={isCatalogOpen} showSearch={false} onClose={closeAll}/>
              </div>
            )}
        {isMobileCatalogOpen && (
            <div className={styles.mobile_catalog}>
              <HeaderCatalog isOpen={isMobileCatalogOpen} showSearch={true} onClose={closeAll} />
            </div>
          )}
        {isMobile && isSearchOpen && (
          <div className={styles.mobile_search_row}>
            <HeaderInput ref={inputRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderCatalogPanel;
