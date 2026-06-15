"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./HeaderPanel.module.scss";
import Image from "next/image";
import HeaderCatalog from "./header-catalog/HeaderCatalog";
import HeaderInput from "./header-input/HeaderInput";
import HeaderAccordion from "./header-accordion/HeaderAccordion";
import HeaderFavorites from "./header-favorites/HeaderFavorites";
import {useOpenInput} from './hooks/useOpenInput'

const HeaderPanel = () => {
  const { isSearchOpen, isCatalogOpen, closeAll , togglePanel } = useOpenInput();
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
    <main className={styles.header_catalog_main}>
      <div
        className={`${styles.header_catalog_block} ${isSearchOpen ? "" : ""}`}
      >
        <Image
          src="/header-icons/Rectangle.svg"
          alt="Лого"
          width={200}
          height={40}
          style={{ width: "auto", height: "auto" }}
          loading="eager"
        />
        <div className={styles.desktop_catalog}>
          <HeaderCatalog />
        </div>
        <div className={styles.desktop_input}>
          <HeaderInput ref={inputRef} />
        </div>
        <div className={styles.desktop_input_search}>
          <button onClick={() => togglePanel('search')}>
            <Image
              src="/header-icons/lupa.svg"
              alt="Лупа"
              width={36}
              height={36}
              style={{ width: "37", height: "37" }}
            />
            <span>Поиск</span>
          </button>
        </div>
        <HeaderAccordion />
        <HeaderFavorites onCatalogClick={() => togglePanel('search')} />
          {isCatalogOpen && (
            <HeaderCatalog />
          )}
        {isMobile && isSearchOpen && (
          <div className={styles.mobile_search_row}>
            <HeaderInput ref={inputRef} />
          </div>
        )}
      </div>
    </main>
  );
};

export default HeaderPanel;
