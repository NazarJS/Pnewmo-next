import { parseCategorySlugFromPath } from './parseCategorySlugFromPath';

describe('parseCategorySlugFromPath', () => {
  it('достаёт слаг категории из пути', () => {
    expect(parseCategorySlugFromPath('/catalog/gidravlika')).toBe('gidravlika');
  });

  it('вложенный сегмент пути не попадает в слаг — берётся только первый', () => {
    expect(parseCategorySlugFromPath('/catalog/gidravlika/extra')).toBe('gidravlika');
  });

  it('вне /catalog/[slug] слага нет', () => {
    expect(parseCategorySlugFromPath('/')).toBeNull();
    expect(parseCategorySlugFromPath('/product/42')).toBeNull();
    expect(parseCategorySlugFromPath('/admin')).toBeNull();
  });

  /**
   * Сегодня недостижимо (все слаги в базе — транслит ASCII), но браузер
   * percent-кодирует не-ASCII сегменты пути, и сырой match()[1] пришёл бы
   * закодированным — сравнение со slug категории молча не совпало бы ни с
   * одной веткой, подсветка меню тихо сломалась бы для первого же
   * кириллического слага.
   */
  it('percent-encoded слаг декодируется', () => {
    const encoded = encodeURIComponent('гидравлика');

    expect(parseCategorySlugFromPath(`/catalog/${encoded}`)).toBe('гидравлика');
  });
});
