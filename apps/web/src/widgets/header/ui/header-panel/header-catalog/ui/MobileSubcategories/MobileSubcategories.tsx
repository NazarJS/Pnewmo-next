import Link from "next/link";
import styles from "./MobileSubcategories.module.scss";
import type { MobileSubcategoriesProps } from "../../../../../lib/types";

const MobileSubcategories = ({
  category,
  onClose,
}: MobileSubcategoriesProps) => {
  if (category.children.length === 0) {
    return null;
  }

  return (
    <ul className={styles.mobile_subcategory_list}>
      {category.children.map((child) => (
        <li key={child.id}>
          <Link
            href={child.url}
            onClick={(event) => {
              event.stopPropagation();
              onClose?.();
            }}
          >
            {child.name}
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default MobileSubcategories;