import React from 'react'
import styles from "./SocialIcons.module.scss";
import {Telegram} from "@/shared/ui/icons/telegram/Telegram";

const SocialIcon = () => {
  return (
    

    <>
    <div className={styles.heading}>Социальные сети</div>
    <div className={styles.content}>
        <a href="" className={styles.item}><Telegram/></a>
        <a href="" className={styles.item}><Telegram/></a>
        <a href="" className={styles.item}><Telegram/></a>
    </div>
    </>
  )
}

export default SocialIcon