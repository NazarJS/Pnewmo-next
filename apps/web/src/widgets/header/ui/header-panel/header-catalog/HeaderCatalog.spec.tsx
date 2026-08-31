import type { Category as CategoryDto } from '@pnewmo/api-contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';

import { CATEGORY_LIST_QUERY_KEY } from '@/entities/category/lib/queryKey';

import HeaderCatalog from './HeaderCatalog';

/**
 * usePathname — единственный next/navigation-хук, от которого зависит
 * HeaderCatalog после задачи 3 (см. entities/category/hooks/
 * useCategorySlugFromUrl.ts): useSearchParams ему больше не нужен, потому
 * что меню каталога перестало тянуть page/limit/offset из сущности товара.
 * jsdom не запускает настоящий Next Router, поэтому usePathname мокается —
 * категории при этом идут через настоящий кэш React Query, не мок хука.
 */
let mockPathname = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

/**
 * Три корневые категории — фактическая форма каталога после пересборки из
 * трёх выгрузок (см. п. «Проверка на живых данных» отчёта задачи 3). У первой
 * и у третьей — по одному ребёнку: этого достаточно, чтобы отличить
 * «подсвечен первый корень» от «подсвечена своя ветка» не только по
 * className в сайдбаре, но и по содержимому мега-меню (какая ветка
 * раскрыта справа).
 */
const categoryDtos: CategoryDto[] = [
  { id: 1, parentId: null, path: '1', slug: 'pnevmatika', name: 'Пневматика' },
  { id: 2, parentId: null, path: '2', slug: 'gidravlika', name: 'Гидравлика' },
  { id: 3, parentId: null, path: '3', slug: 'smazochnaya-tehnika', name: 'Смазочная техника' },
  { id: 11, parentId: 1, path: '1.11', slug: 'cilindry', name: 'Цилиндры' },
  { id: 31, parentId: 3, path: '3.31', slug: 'masla', name: 'Масла' },
];

/**
 * Категории подкладываются в настоящий QueryClient под тем же ключом, что
 * читает useCategories (tsr.categories.list.useQuery), а не подменой самого
 * хука: так тест проверяет реальную проводку HeaderCatalog -> useCategories
 * -> tsr -> React Query кэш, а не то, что подставлено в моке хука.
 * staleTime у useCategories — 10 минут, поэтому свежая запись в кэше не
 * триггерит настоящий сетевой запрос при монтировании.
 */
function renderHeaderCatalog(pathname: string) {
  mockPathname = pathname;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  queryClient.setQueryData(CATEGORY_LIST_QUERY_KEY, { status: 200, body: categoryDtos });

  return render(
    <QueryClientProvider client={queryClient}>
      <HeaderCatalog isOpen showSearch={false} />
    </QueryClientProvider>,
  );
}

describe('HeaderCatalog', () => {
  beforeEach(() => {
    // isDesktop читает window.innerWidth в эффекте на маунте — без этого
    // мега-меню (activeCategory && isDesktop) не рендерится вовсе, и
    // подсветку ветки нечем было бы проверить по содержимому правой панели.
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
  });

  it('показывает три корневые категории и их названия', () => {
    const { container } = renderHeaderCatalog('/');
    const sidebar = container.querySelector('.categories_list') as HTMLElement;

    expect(within(sidebar).getByText('Пневматика')).toBeInTheDocument();
    expect(within(sidebar).getByText('Гидравлика')).toBeInTheDocument();
    expect(within(sidebar).getByText('Смазочная техника')).toBeInTheDocument();
  });

  it.each(['/', '/product/42'])('вне каталога (%s) подсвечена первая корневая категория', (pathname) => {
    const { container } = renderHeaderCatalog(pathname);
    const sidebar = container.querySelector('.categories_list') as HTMLElement;
    const megaMenu = container.querySelector('.mega_menu') as HTMLElement;

    const firstRootItem = within(sidebar).getByText('Пневматика').closest('li');
    const otherRootItem = within(sidebar).getByText('Гидравлика').closest('li');

    expect(firstRootItem).toHaveClass('active');
    expect(otherRootItem).not.toHaveClass('active');

    // Мега-меню сразу заполнено веткой первой корневой, а не пустует до
    // наведения (см. отчёт задачи 3, п.5): показан её ребёнок, не ребёнок
    // другой ветки. Пункты сайдбара сюда не входят — .mega_menu это правая
    // панель, а не аккордеон внутри CategoryItem.
    expect(megaMenu).not.toBeNull();
    expect(within(megaMenu).getByText('Цилиндры')).toBeInTheDocument();
    expect(within(megaMenu).queryByText('Масла')).not.toBeInTheDocument();
  });

  it('на странице категории подсвечена именно её ветка, а не первая корневая', () => {
    const { container } = renderHeaderCatalog('/catalog/smazochnaya-tehnika');
    const sidebar = container.querySelector('.categories_list') as HTMLElement;
    const megaMenu = container.querySelector('.mega_menu') as HTMLElement;

    const ownRootItem = within(sidebar).getByText('Смазочная техника').closest('li');
    const firstRootItem = within(sidebar).getByText('Пневматика').closest('li');

    expect(ownRootItem).toHaveClass('active');
    expect(firstRootItem).not.toHaveClass('active');

    // Регресс-проверка по существу, не только по className: мега-меню
    // показывает ребёнка СВОЕЙ ветки (Масла), а не первой корневой
    // (Цилиндры). Если подсветку откатить на «всегда первая корневая», это
    // условие ловит регресс так же надёжно, как и className выше — красный
    // прогон на такой откат зафиксирован в отчёте задачи 3.
    expect(megaMenu).not.toBeNull();
    expect(within(megaMenu).getByText('Масла')).toBeInTheDocument();
    expect(within(megaMenu).queryByText('Цилиндры')).not.toBeInTheDocument();
  });
});
