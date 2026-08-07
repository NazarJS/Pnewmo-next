import Link from "next/link";
import styles from "./MegaMenu.module.scss";
import { CategoryWithChildren } from "@/entities/category/model/types";

interface MegaMenuProps {
  category: CategoryWithChildren;
  
  onClose?: () => void;
}

const MegaMenu = ({ category, onClose }: MegaMenuProps) => {
  return (
    <div className={styles.subcategories_wrapper}>
      {category.children.map((subcategory) => (
        <div
          key={subcategory.id}
          className={styles.subcategory_group}
        >
          <h4 className={styles.subcategory_title}>
            <Link
              href={subcategory.url}
              onClick={onClose}
            >
              {subcategory.name}
            </Link>
          </h4>

          {subcategory.children.length > 0 && (
            <ul className={styles.subcategory_grid}>
              {subcategory.children.map((child) => (
                <li
                  key={child.id}
                  className={styles.subcategory_item}
                >
                  <Link
                    href={child.url}
                    onClick={onClose}
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export default MegaMenu;