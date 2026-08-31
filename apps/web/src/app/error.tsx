'use client';

import { useEffect } from 'react';

import { SERVER_FAILURE_MESSAGE } from '@/shared/lib/apiError';

import type { ErrorPageProps } from './types';
import styles from './Error.module.scss';

/**
 * Граница ошибок App Router (обязательный файл `error.tsx` на уровне сегмента,
 * рендерится Next при любом непойманном throw из компонентов ниже по дереву —
 * в частности из catalog/[slug]/page.tsx и product/[id]/page.tsx при сбое
 * ручки товаров). Next сам не подставляет свой отладочный экран, если этот
 * файл на месте, но и не задаёт статус ответа сам по себе — честный HTTP 500
 * для сбойного рендера Server Component это и есть штатное поведение App
 * Router: сама постановка error.tsx на маршруте превращает непойманный throw
 * в 500 (правило заказчика №1), без ручной установки кода.
 *
 * Текст на экране — фиксированная фраза (SERVER_FAILURE_MESSAGE, та же, что и
 * у сбоя сервера в classifyApiError), а не error.message: сюда долетает любой
 * непойманный throw, не только наши — message может быть техническим или
 * вовсе не предназначенным для показа посетителю. Ошибку саму логируем в
 * консоль ниже — этого достаточно, чтобы не потерять причину при отладке.
 */
const ErrorPage = ({ error, reset }: ErrorPageProps) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>{SERVER_FAILURE_MESSAGE}</h1>

      <p className={styles.text}>
        Мы уже знаем о сбое. Обновите страницу через минуту или попробуйте ещё раз сейчас.
      </p>

      <button type="button" className={styles.button} onClick={() => reset()}>
        Повторить
      </button>
    </div>
  );
};

export default ErrorPage;
