import Link from "next/link";
import { CategoryWithChildren } from "@/entities/category/lib/types";
import MobileSubcategories from "../MobileSubcategories/MobileSubcategories";
import styles from "./CategoryItem.module.scss";
import { Arrow } from "@/shared/ui/icons/arrow/Arrow";


interface CategoryItemProps {
  category: CategoryWithChildren;
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  onClose?: () => void;
}


const CategoryItem = ({
  category,
  isActive,
  onMouseEnter,
  onClick,
  onClose,
}: CategoryItemProps) => {

  return (
    <li
      className={`${styles.category_item} ${
        isActive ? styles.active : ""
      }`}
      onMouseEnter={onMouseEnter}
    >

      <div
        className={styles.category_header}
        onClick={onClick}
      >

        <Link
          href={category.url}
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
        >
          <span>
            {category.name}
          </span>
        </Link>


        {category.children.length > 0 && (
          <div
            className={`${styles.active_arrow} ${
              isActive ? styles.active : ""
            }`}
          >
             <Arrow className={styles.arrow} />
          </div>
        )}

      </div>


      <div
        className={`${styles.mobile_accordion} ${
          isActive ? styles.accordion_open : ""
        }`}
      >
        <MobileSubcategories
          category={category}
          onClose={onClose}
        />
      </div>


    </li>
  );
};


export default CategoryItem;