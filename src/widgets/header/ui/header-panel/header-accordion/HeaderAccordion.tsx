import { useState } from "react";
import Image from "next/image";
import styles from "./HeaderAccordion.module.scss";
import Email from "@/shared/ui/icons/email/Email";
import Phone from "@/shared/ui/icons/phone/Phone"

const HeaderAccordion = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <address className={styles.contacts_address}>
      <div className={styles.bigPhone_block} onClick={toggleDropdown}>
        <Phone/>
        <span className={styles.span}>Контакты</span>
      </div>
      <div className={styles.email_block}>
        <Email />
        <a href="mailto:info@pneumo-center.by" className={styles.email_text}>
          info@pneumo-center.by
        </a>
      </div>
      <div className={styles.accordion_wrapper}>
        <div
          className={`${styles.accordion_trigger} ${isOpen ? styles.active : ""}`}
          onClick={toggleDropdown}
        >
          <Image
            src="/header-icons/phone.svg"
            alt="телефон"
            width={20}
            height={20}
            style={{ width: "auto", height: "auto" }}
            className={styles.phone_icon}
          />
          <span className={styles.phone_link}>+375 (232) 214-222</span>
          <Image
            src="/header-icons/arrow.svg"
            alt="стрелка"
            width={20}
            height={20}
            style={{ width: "auto", height: "auto" }}
            className={`${styles.arrow_icon} ${isOpen ? styles.arrow_rotated : ""}`}
          />
        </div>
        {isOpen && (
          <div className={styles.contacts_dropdown}>
            <button
              type="button"
              className={styles.close_button}
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть"
            >
              &times;
            </button>
            <div className={styles.dropdown_header}>
              <h3 className={styles.dropdown_phone}>+375 (232) 214-222</h3>
              <p className={styles.dropdown_subtitle}>Пн - Пт: 9:00 - 18:00</p>
            </div>
            <button type="button" className={styles.callback_button}>
              Заказать обратный звонок
            </button>
            <hr className={styles.divider} />
            <div className={styles.dropdown_section}>
              <span className={styles.section_label}>Email</span>
              <a
                href="mailto:info@pnewmo-center.by"
                className={styles.section_link}
              >
                info@pneumo-center.by
              </a>
            </div>
            <div className={styles.dropdown_messengers}>
              <a
                href="https://wa.me/375232214222"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.messenger_item}
              >
                <Image
                  src="/header-icons/whats.svg"
                  alt="WhatsApp"
                  width={20}
                  height={20}
                />
                <span>WhatsApp</span>
              </a>
              <a
                href="https://t.me/pneumocenter"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.messenger_item}
              >
                <Image
                  src="/header-icons/tg.svg"
                  alt="Telegram"
                  width={20}
                  height={20}
                />
                <span>Telegram</span>
              </a>
            </div>
            <hr className={styles.divider} />
            <div className={styles.dropdown_section}>
              <span className={styles.section_label}>Адрес</span>
              <p className={styles.address_text}>
                Беларусь, г. Гомель, ул. Пушкина д.Колотушкина
              </p>
            </div>
            <div className={styles.dropdown_schedules}>
              <div className={styles.schedule_block}>
                <span className={styles.schedule_label}>
                  График работы офиса
                </span>
                <p className={styles.schedule_time}>Пн - Вс: 9:00 - 18:00</p>
              </div>
              <div className={styles.schedule_block}>
                <span className={styles.schedule_label}>
                  График работы склада
                </span>
                <p className={styles.schedule_time}>Пн - Вс: 9:00 - 17:00</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </address>
  );
};

export default HeaderAccordion;
