import { useState } from "react";
import Image from "next/image";
import styles from "./HeaderAccordion.module.scss";
import Email from "@/shared/ui/icons/email/Email";
import PhoneInMobile from "@/shared/ui/icons/phone/PhoneInMobile";
import PhoneInDesktop from "@/shared/ui/icons/phone/PnoneInDesktop";

import { Arrow } from "@/shared/ui/icons/arrow/Arrow";
import { WhatsApp } from "@/shared/ui/icons/whatsApp/WhatsApp";
import { TelegramLink } from "@/shared/ui/icons/telegram/Telegram";

const HeaderAccordion = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <address className={styles.contacts_address}>
      <div className={styles.bigPhone_block} onClick={toggleDropdown}>
        <PhoneInMobile />
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
          <PhoneInDesktop />
          <span className={styles.phone_link}>+375 (232) 214-222</span>
          <div className={`${styles.active_arrow} ${isOpen ? styles.active : ""}`}>
            <Arrow className={styles.arrow} />
          </div>
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
            <p className={styles.dropdown_header}>
              <a href=" tel:+375(232)21-42-22" className={styles.dropdown_phone}>
                +375 (232)214-222
              </a>
              <small className={styles.dropdown_subtitle}>Пн - Пт: 9:00 - 18:00</small>
            </p>
            <button type="button" className={styles.callback_button}>
              Заказать обратный звонок
            </button>
            <hr className={styles.divider} />
            <div className={styles.dropdown_section}>
              <span className={styles.section_label}>Email</span>
              <a href="mailto:info@pnewmo-center.by" className={styles.section_link}>
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
                <WhatsApp />
                <span>WhatsApp</span>
              </a>
              <a
                href="https://t.me/pneumocenter"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.messenger_item}
              >
                <TelegramLink />
                <span>Telegram</span>
              </a>
            </div>
            <hr className={styles.divider} />
            <div className={styles.dropdown_section}>
              <span className={styles.section_label}>Адрес</span>
              <p className={styles.address_text}>Беларусь, г. Гомель, ул. Пушкина д.Колотушкина</p>
            </div>
            <div className={styles.dropdown_schedules}>
              <div className={styles.schedule_block}>
                <span className={styles.schedule_label}>График работы офиса</span>
                <p className={styles.schedule_time}>Пн - Вс: 9:00 - 18:00</p>
              </div>
              <div className={styles.schedule_block}>
                <span className={styles.schedule_label}>График работы склада</span>
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
