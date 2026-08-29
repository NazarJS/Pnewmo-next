import { readNumberParam, resolveLimit, resolvePage, toOffset } from './pagination';

describe('resolvePage', () => {
  it('берёт число из адреса', () => {
    expect(resolvePage(3, 1)).toBe(3);
  });

  it('подставляет дефолт при отсутствии параметра', () => {
    expect(resolvePage(undefined, 1)).toBe(1);
  });

  it('отбрасывает ноль', () => {
    expect(resolvePage(0, 1)).toBe(1);
  });

  it('отбрасывает отрицательное', () => {
    expect(resolvePage(-5, 1)).toBe(1);
  });

  /**
   * Ловушка, ради которой правило и существует: Number('Infinity') даёт
   * Infinity, и наивная проверка raw > 0 его пропускает. Дальше Infinity уходит
   * в offset и роняет запрос.
   */
  it('отбрасывает Infinity', () => {
    expect(resolvePage(Number('Infinity'), 1)).toBe(1);
  });

  it('отбрасывает NaN', () => {
    expect(resolvePage(Number('abc'), 1)).toBe(1);
  });
});

describe('resolveLimit', () => {
  it('берёт число из адреса', () => {
    expect(resolveLimit(48, 24)).toBe(48);
  });

  it('подставляет дефолт на мусоре', () => {
    expect(resolveLimit(Number('Infinity'), 24)).toBe(24);
  });

  /**
   * Потолок совпадает с потолком контракта. Без него страница попросила бы
   * limit=100000, сервер ответил бы 400, и посетитель увидел бы ошибку вместо
   * товаров.
   */
  it('обрезает по потолку контракта', () => {
    expect(resolveLimit(100000, 24)).toBe(100);
  });
});

describe('toOffset', () => {
  it('первая страница начинается с нуля', () => {
    expect(toOffset(1, 24)).toBe(0);
  });

  it('вторая страница сдвинута на размер страницы', () => {
    expect(toOffset(2, 24)).toBe(24);
  });
});

describe('readNumberParam', () => {
  /**
   * Next отдаёт string[], когда параметр повторён в адресе (?page=2&page=5).
   * Берём первое значение — остальные отбрасываются молча, как и в resolvePage
   * ниже по цепочке.
   */
  it('берёт первое значение из массива при повторе параметра в адресе', () => {
    expect(readNumberParam(['3', '5'])).toBe(3);
  });

  it('возвращает undefined при отсутствии параметра', () => {
    expect(readNumberParam(undefined)).toBeUndefined();
  });

  /**
   * Нечисловая строка превращается в NaN, а не в undefined и не бросает
   * исключение. Это осознанно переложено на resolvePage/resolveLimit: их
   * Number.isFinite дальше по цепочке уже отбраковывает NaN и подставляет
   * дефолт. readNumberParam сам по себе не валидирует ввод.
   */
  it('возвращает NaN на нечисловой строке, а не бросает и не подставляет значение по умолчанию', () => {
    expect(readNumberParam('не число')).toBeNaN();
  });
});
