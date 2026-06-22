import Image from "next/image";
import Header from "@/widgets/header/Header";
import styles from "@/app/page.module.scss"


export default function MainPage() {
  return (
    <>
      <main className={styles.main_container}>
      <Header/>
      </main>
    </>
  );


  
}
