import React, { useState, useRef, useEffect } from "react";
import styles from "./HeaderInput.module.scss";
import Image from "next/image";

interface HeaderInputProps {
  ref?: React.Ref<HTMLInputElement>;
  onClose?: () => void;
}

const HeaderInput = ({ ref, onClose }: HeaderInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const updatePlaceholderByWidth = () => {
      const width = input.offsetWidth;
      const size =
        width < 100
          ? "..."
          : width < 150
            ? "Найти..."
            : width < 160
              ? "Найти товар..."
              : "Найти товары"; // подумать: оставлять или нет
      input.placeholder = size;
    };
    updatePlaceholderByWidth();

    const resizeObserver = new ResizeObserver(updatePlaceholderByWidth);
    resizeObserver.observe(input);

    return () => resizeObserver.disconnect();
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

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
