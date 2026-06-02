import React, { useState, useRef } from "react";
import styles from "./HeaderInput.module.scss";
import Image from "next/image";

const HeaderInput = () => {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      console.log("Ищем:", search);
    }
  };
  const handleClear = () => {
    setSearch("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <>
      <form onChange={handleSearch} className={styles.search_form}>
        <input
          ref={inputRef}
          name="search-input"
          type="text"
          placeholder="Найти товары"
          className={styles.search_input}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {search && (
          <button
            type="button"
            className={styles.clear_button}
            onClick={handleClear}
            aria-label="Очистить поиск"
          >
            <Image
              src="/header-icons/cross.svg"
              alt="Крестик"
              width={25}
              height={25}
            />
          </button>
        )}
        {search && (
          <button type="submit" className={styles.search_button}>
            Найти
          </button>
        )}
      </form>
    </>
  );
};

export default HeaderInput;
