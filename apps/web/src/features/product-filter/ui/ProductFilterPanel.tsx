'use client';
import styles from './ProductFilterPanel.module.scss';

import React from 'react';

interface ProductFilterPanelProps {}

export const ProductFilterPanel = () => {
  return (
    <aside className={styles.container_panel}>
      <h3 className={styles.h3}>Фильтр</h3>
      <form action="" className={styles.form}>
        <div className="item-1"></div>
        <div className="item-2"></div>
        <div className="item-3"></div>
        <div className="item-4"></div>
        <div className="item-5"></div>
        
        <div className="filter-button">
          <div className="btn-apply">
            <input type="button" className="input" value="Сбросить" />
          </div>
          <div className="btn-reset">
            <input type="button" className="input" value="Показать" />
          </div>
        </div>
      </form>
    </aside>
  );
};
