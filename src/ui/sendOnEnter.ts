import type { KeyboardEvent } from 'react';

/**
 * Enter в поле сообщения отправляет его продавцу, Shift+Enter переносит строку.
 *
 * Как в мессенджерах, к которым привыкли покупатели: без этого Enter молча
 * добавлял пустую строку, и человек ждал ответа на неотправленный вопрос.
 * Пока идёт набор через IME (казахская раскладка на телефоне), Enter
 * подтверждает слово, а не отправляет — иначе вопрос ушёл бы оборванным.
 */
export function sendOnEnter(send: () => void) {
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };
}
