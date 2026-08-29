import CategoryForm from '@/features/catalog-admin/ui/CategoryForm';
import ProductForm from '@/features/catalog-admin/ui/ProductForm';

/**
 * Страница намеренно без защиты — решение заказчика, зафиксированное в спеке.
 * Перед выкатом в прод закрыть обязательно: формы пишут в базу, а пишущие ручки
 * API тоже открыты.
 */
export default function AdminPage() {
  return (
    <section>
      <h1>Администрирование каталога</h1>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <CategoryForm />
        <ProductForm />
      </div>
    </section>
  );
}
