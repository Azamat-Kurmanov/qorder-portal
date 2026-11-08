import { useCallback, useMemo, useRef, useState } from 'react';
import type { FieldRule } from '../../api/rules.generated';
import type { FieldFault } from '../Field';

/**
 * Что отдаёт хук.
 *
 * Объявлено отдельным типом, а не выведено: набор уезжает свойством в формы,
 * собранные из родителя и ребёнка, — там вывод по `ReturnType` разваливается,
 * и ребёнок получает «ничто» вместо набора.
 */
export interface FormRules<T extends Record<string, string>> {
  values: T;
  faults: Partial<Record<keyof T, FieldFault>>;
  /** Отказ, который не лёг ни на одно поле. */
  formFault: string | undefined;
  /** Годно ли введённое прямо сейчас — молча. */
  isValid: boolean;
  field: (name: keyof T & string) => {
    name: string;
    value: string;
    rule: FieldRule | undefined;
    fault: FieldFault | undefined;
    onChange: (value: string) => void;
    onBlur: () => void;
  };
  validate: () => boolean;
  applyServerFault: (error: unknown) => void;
  reset: (next?: T) => void;
}

/**
 * Проверка полей по правилам контракта.
 *
 * Хук проверяет ровно то, что объявлено в схеме: обязательность, шаблон,
 * длину, почту. Больше он не выдумывает — всё остальное знает сервер,
 * и его ответ ложится под то же поле через applyServerFault.
 *
 * Момент показа: пока набирают — молчим, ушли из поля или нажали кнопку —
 * говорим. Сказанное гаснет при первом же исправлении: поле, оставшееся
 * красным с верным значением, учит не верить подсказкам вовсе.
 */
export function useFormRules<T extends Record<string, string>>({ schema, initial }: {
  schema: Record<string, FieldRule>;
  initial: T;
}): FormRules<T> {
  const [values, setValues] = useState<T>(initial);
  const [faults, setFaults] = useState<Partial<Record<keyof T, FieldFault>>>({});
  const [formFault, setFormFault] = useState<string | undefined>(undefined);
  /*
    Значения ещё и в ref, потому что onBlur может сработать в одном тике
    с onChange — до перерисовки. Замыкание в этот момент помнит прежнее
    значение, и проверка пожаловалась бы на поле, которое человек уже
    исправил. Ref обновляется синхронно, поэтому видит введённое.
  */
  const valuesRef = useRef(values);

  // Одна и та же проверка на оба устройства форм: здесь она получает правило
  // из схемы, а чистая функция ниже — прямо от вызывающего.
  const check = useCallback(
    (name: string, value: string) => faultOf(schema[name], value),
    [schema],
  );

  const field = useCallback((name: keyof T & string) => ({
    name,
    value: values[name],
    rule: schema[name],
    fault: faults[name],
    onChange: (value: string) => {
      valuesRef.current = { ...valuesRef.current, [name]: value };
      setValues(valuesRef.current);
      setFaults((current) => {
        if (!current[name]) return current;
        // Гасим, как только значение стало годным, — но не заводим новую
        // жалобу на полпути: человек ещё набирает.
        if (check(name, value)) return current;
        const next = { ...current };
        delete next[name];
        return next;
      });
    },
    onBlur: () => {
      const fault = check(name, valuesRef.current[name]);
      setFaults((current) => {
        const next = { ...current };
        if (fault) next[name] = fault;
        else delete next[name];
        return next;
      });
    },
  }), [values, faults, schema, check]);

  /**
   * Годно ли введённое прямо сейчас — без того, чтобы что-то сказать.
   *
   * Нужно формам, которые гасят кнопку до полного заполнения: условие «что
   * считать полным» обязано быть тем же, по которому потом проверяется
   * отправка, иначе кнопка оживает раньше, чем форма становится годной.
   * Считается по правилам контракта, а не своим условием на экране.
   */
  const isValid = useMemo(
    () => Object.keys(values).every((name) => !check(name, values[name])),
    [values, check],
  );

  const validate = useCallback(() => {
    const found: Partial<Record<keyof T, FieldFault>> = {};
    for (const name of Object.keys(valuesRef.current) as (keyof T & string)[]) {
      const fault = check(name, valuesRef.current[name]);
      if (fault) found[name] = fault;
    }
    setFaults(found);
    setFormFault(undefined);
    return Object.keys(found).length === 0;
  }, [check]);

  const applyServerFault = useCallback((error: unknown) => {
    const info = (error as { info?: { detail?: string; errors?: { field?: string; message?: string }[] } })?.info;
    const byField = info?.errors ?? [];
    const found: Partial<Record<keyof T, FieldFault>> = {};
    for (const item of byField) {
      if (!item.field || !(item.field in valuesRef.current)) continue;
      found[item.field as keyof T] = { rule: 'server', message: item.message };
    }
    const unmatched = byField.filter((item) => !item.field || !(item.field in valuesRef.current));
    setFaults(found);
    // Общий отказ показывается, когда сказать под полем нечего: разбора
    // не было вовсе либо часть ошибок пришла о полях, которых в форме
    // нет. Молча проглоченный отказ сервера — то же самое, что его
    // отсутствие.
    setFormFault(Object.keys(found).length === 0 || unmatched.length > 0 ? info?.detail : undefined);
  }, []);

  /**
   * Вернуть форму к исходному — или к новому — состоянию.
   *
   * Без аргумента это «очистить после удачной отправки». С аргументом —
   * «показать то, что записал сервер»: он хранит строки по-своему (обрезает
   * пробелы, переписывает ссылку облака в адрес файла), и форма, оставшаяся
   * с набранным, показывала бы не сохранённое.
   */
  const reset = useCallback((next?: T) => {
    const target = next ?? initial;
    valuesRef.current = target;
    setValues(target);
    setFaults({});
    setFormFault(undefined);
  }, [initial]);

  return { values, faults, formFault, isValid, field, validate, applyServerFault, reset };
}

/**
 * Почта проверяется грубо и намеренно: есть собака, по бокам непусто,
 * в домене есть точка. Точную проверку делает сервер, а форма ловит опечатку.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Что не так со значением по правилу контракта — без состояния и без экрана.
 *
 * Вынесено из хука, потому что формы бывают двух устройств. Одни держат свои
 * значения сами — им хук; другие правят чужой черновик, живущий выше
 * (карточка позиции каталога), и второе состояние рядом с ним означало бы два
 * ответа на вопрос «что сейчас в поле». Правило при этом обязано быть одно,
 * поэтому проверку зовут оба.
 */
export function faultOf(rule: FieldRule | undefined, value: string): FieldFault | undefined {
  if (!rule) return undefined;
  const trimmed = value.trim();
  if (rule.required && trimmed === '') return { rule: 'required' };
  // Пустое необязательное поле проверять нечем: «не введено» — это
  // не «введено неверно».
  if (trimmed === '') return undefined;
  if (rule.pattern && !rule.pattern.test(trimmed)) return { rule: 'pattern' };
  if (rule.format === 'email' && !EMAIL.test(trimmed)) return { rule: 'email' };
  if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
    return { rule: 'minLength', params: { min: rule.minLength } };
  }
  if (rule.maxLength !== undefined && trimmed.length > rule.maxLength) {
    return { rule: 'maxLength', params: { max: rule.maxLength } };
  }
  return undefined;
}
