import Image from 'next/image';
import Link from 'next/link';

import { formatPrice } from '@/entities/product/lib/formatPrice';
import type { Product } from '@/entities/product/lib/types';

import styles from './ProductCard.module.scss';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <Link href={`/product/${product.id}`} className={styles.card}>
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={282}
        height={148}
        className={styles.image}
        // Размеры карточек в сетке фиксированы, поэтому sizes достаточно
        // грубого: точная подстройка не нужна, а без атрибута Next ругается.
        sizes="(max-width: 768px) 50vw, 25vw"
      />

      <h2 className={styles.name}>{product.name}</h2>

      <p className={styles.price}>{formatPrice(product.price)}</p>
    </Link>
  );
};

export default ProductCard;
