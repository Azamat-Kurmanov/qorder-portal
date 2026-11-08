/** «Ещё» всегда открывается с самого верха — и раздел «Ещё», и меню поверх страницы. */
export const toTop = () => window.scrollTo({ top: 0, behavior: 'instant' });
