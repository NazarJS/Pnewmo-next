"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./HeaderPanel.module.scss";
import Image from "next/image";
import HeaderCatalog from "./header-catalog/HeaderCatalog";
import HeaderInput from "./header-input/HeaderInput";
import HeaderAccordion from "./header-accordion/HeaderAccordion";
import HeaderFavorites from "./header-favorites/HeaderFavorites";

const HeaderPanel = () => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
      if (window.innerWidth > 1024) {
        setIsMobileSearchOpen(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobileSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  return (
    <main className={styles.header_catalog_main}>
      <div
        className={`${styles.header_catalog_block} ${isMobileSearchOpen ? styles.extends : ""}`}
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
          <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}>
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
        <HeaderFavorites />
        {isMobile && isMobileSearchOpen && (
          <div className={styles.mobile_search_row}>
            <HeaderInput ref={inputRef} />
          </div>
        )}
      </div>
    </main>
  );
};

export default HeaderPanel;
