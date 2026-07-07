import React from 'react'
import styles from "./FooterBottom.module.scss";

const FooterBottom = () => {
  return (

    <div className={styles.footer_bottom}>
        <div className="container">
            <span className={styles.txt}>
                «PneumoCenter» 1999-2025. Все права защищены
                Политика конфедициальности
            </span>
        </div>    
    </div>
    
  )
}

export default FooterBottom