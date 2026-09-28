/**
 * Какие номера страниц показать — по макету «Постраничная навигация»:
 * не больше семи кнопок — первая, последняя, соседи текущей и «…».
 *
 * Страницы здесь с единицы, как их видит человек. Семь — потому что ряд
 * из двадцати пяти номеров на телефоне уходит во вторую строку, а первая
 * и последняя нужны всегда: к ним возвращаются чаще, чем к соседним.
 */
export function pageItems(page: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'gap', count];
  if (page >= count - 3) return [1, 'gap', count - 4, count - 3, count - 2, count - 1, count];
  return [1, 'gap', page - 1, page, page + 1, 'gap', count];
}
