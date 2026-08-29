import Image from 'next/image';
import { notFound } from 'next/navigation';

import { formatPrice } from '@/entities/product/lib/formatPrice';
import { api } from '@/shared/api/client';
import { classifyApiError } from '@/shared/lib/apiError';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  // /^\d+$/, а не Number.isInteger(Number(id)): у Number() научная нотация и
  // шестнадцатеричные литералы — валидные числа. /product/1e2 и /product/0x10
  // проходили старую проверку (Number('1e2') === 100, Number('0x10') === 16,
  // оба целые и положительные) и отдавали 200 с товарами 100 и 16 — дубль
  // индексируемого адреса на каждый такой id.
  if (!/^\d+$/.test(id)) {
    notFound();
  }

  const numericId = Number(id);

  // /^\d+$/ пропускает "0" (и "00" и т.д.) — цифра, но не положительное число.
  // Товара с id 0 не бывает, и без этой проверки запрос ушёл бы в API вместо
  // того, чтобы сразу остаться 404 на странице.
  if (numericId <= 0) {
    notFound();
  }

  const response = await api.products.getById({ params: { id: numericId } });

  if (response.status !== 200) {
    const classification = classifyApiError(response);

    // notFound() — это HTTP 404, «такой страницы не существует». Сбой
    // бэкенда — другое: страница существует, просто сейчас недоступна.
    // Смешивать их нельзя — проверено вживую: при погашенном API за прокси
    // (502) запрос существующего товара отдавал 404 вместо 502. Для витрины,
    // где боты — целевая аудитория, это худший вариант: 5xx поисковик
    // переживёт и зайдёт позже, а 404 выбьет существующий товар из индекса.
    if (classification.kind === 'notFound') {
      notFound();
    }

    if (classification.kind === 'server') {
      // 5xx — честный 500 через границу ошибок (app/error.tsx), правило
      // заказчика №1.
      throw new Error(classification.message);
    }

    // 400 и подобное — текст ошибки от API показываем как есть, без подмены
    // на 404 или 500 (правило №2). Страница отвечает обычным рендером, не
    // бросает и не зовёт notFound().
    return <p>{classification.message}</p>;
  }

  const product = response.body;
  const specifications = Object.entries(product.specifications);

  return (
    <article>
      <h1>{product.name}</h1>

      <Image src={product.imageUrl} alt={product.name} width={282} height={148} sizes="282px" />

      <p>{formatPrice(product.price)}</p>

      {specifications.length > 0 && (
        <table>
          <tbody>
            {specifications.map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
