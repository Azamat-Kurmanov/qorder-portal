/**
 * Создано автоматически: npm run api:generate. Руками не править.
 *
 * Правила приезжают из openapi.json — того же файла, из которого сделаны
 * типы. Разойтись с сервером форма не может: своего мнения о длине телефона
 * у неё нет.
 */

export interface FieldRule {
  required: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  format?: 'email';
  example?: string;
}

export const rules = {
  UpdateStaffRolesRequest: {

  },
  UpdateSellerDetailsRequest: {
    name: { required: true, maxLength: 255, example: "ТОО «Стройбаза»" },
    binIin: { required: false, pattern: /^(?:^\s*$|^\d{12}$)$/, example: "123456789012" },
    address: { required: false, maxLength: 512, example: "Алматы, пр. Рыскулова 232/4" },
    contact: { required: false, maxLength: 128, example: "+7 727 000 00 00" },
    logoUrl: { required: false, pattern: /^(?:^\s*$|^https?:\/\/\S+$)$/, maxLength: 2048, example: "https://cdn.example.kz/stroybaza.png" },
    bankName: { required: false, maxLength: 255, example: "АО «Народный Банк Казахстана»" },
    bankBic: { required: false, maxLength: 16, example: "HSBKKZKX" },
    bankAccount: { required: false, maxLength: 34, example: "KZ123456789012345678" },
    bankKbe: { required: false, pattern: /^(?:^\s*$|^\d{2}$)$/, example: "17" },
  },
  SaveRoleRequest: {
    name: { required: true, maxLength: 64, example: "Старший кладовщик" },
  },
  TenantDetailsRequest: {
    name: { required: true, minLength: 1, example: "ТОО Поставщик" },
    binIin: { required: false, pattern: /^(?:\d{12}|)$/, example: "210840005678" },
  },
  SetAccountAccessRequest: {

  },
  UpdatePlatformSettingsRequest: {
    name: { required: true, maxLength: 255 },
    binIin: { required: false, pattern: /^(?:|\d{12})$/ },
    address: { required: false, maxLength: 512 },
    contact: { required: false, maxLength: 128 },
    bankName: { required: false, maxLength: 255 },
    bankBic: { required: false, maxLength: 16 },
    bankAccount: { required: false, maxLength: 34 },
    bankKbe: { required: false, pattern: /^(?:|\d{2})$/ },
  },
  UpdateWhatsappPackageRequest: {

  },
  BusinessDayHoursRequest: {
    opensAt: { required: false, example: "09:00" },
    closesAt: { required: false, example: "18:00" },
    breakStart: { required: false, example: "13:00" },
    breakEnd: { required: false, example: "14:00" },
  },
  UpdateBusinessHoursRequest: {

  },
  SetCartLineRequest: {

  },
  UpdateDraftRequest: {
    customerName: { required: false },
    deliveryAddress: { required: false },
    deliveryDate: { required: false },
  },
  PickupPointRequest: {
    name: { required: true, maxLength: 255, example: "Склад на Рыскулова" },
    address: { required: true, maxLength: 512, example: "ул. Рыскулова 12" },
    workingHours: { required: false, maxLength: 255, example: "пн-сб 9:00-18:00" },
  },
  DeliveryModeRequest: {
    mode: { required: true },
  },
  DeliveryMethodRequest: {
    name: { required: true, maxLength: 255, example: "Доставка по Алматы" },
    type: { required: true },
    tariffRule: { required: true },
  },
  ReorderItemMediaRequest: {

  },
  SaveCatalogItemRequest: {
    sku: { required: false, maxLength: 64, example: "CEM-400" },
    name: { required: true, maxLength: 512, example: "Цемент М-400" },
    unit: { required: true, maxLength: 64, example: "мешок" },
    description: { required: false, maxLength: 4000, example: "Влагостойкая плита, 9 мм, лист 2500×1250" },
    categoryId: { required: false },
  },
  SetItemVisibilityRequest: {

  },
  FieldOptionRequest: {
    code: { required: true, pattern: /^(?:^[A-Za-z][A-Za-z0-9_]{0,63}$)$/, maxLength: 64, example: "WINTER" },
    name: { required: true, maxLength: 120, example: "Зима" },
  },
  UpdateFieldRequest: {
    name: { required: false, pattern: /^(?:.*\S.*)$/, maxLength: 120, example: "Время года" },
    type: { required: false },
    unit: { required: false, maxLength: 16, example: "л" },
  },
  SaveItemCategoryRequest: {
    name: { required: true, maxLength: 255, example: "Сухие смеси" },
    parentId: { required: false },
  },
  CreateStaffRequest: {
    phone: { required: true, pattern: /^(?:7\d{10})$/, minLength: 1, example: "77010000105" },
    name: { required: true, minLength: 1, example: "Асхат Каримов" },
    email: { required: true, minLength: 1, format: "email", example: "askhat@example.kz" },
  },
  CreateTenantAccountRequest: {
    phone: { required: true, pattern: /^(?:7\d{10})$/, minLength: 1, example: "77010000201" },
    name: { required: true, minLength: 1, example: "Айгуль Сериковна" },
    email: { required: true, minLength: 1, format: "email", example: "aigul@example.kz" },
  },
  IssueServiceInvoiceRequest: {
    currency: { required: true, pattern: /^(?:[A-Z]{3})$/ },
  },
  CancelServiceRequestRequest: {
    reason: { required: true, maxLength: 512 },
  },
  AddChannelRequest: {
    phone: { required: true, pattern: /^(?:\d{10,15})$/, minLength: 1 },
    displayName: { required: false, maxLength: 255 },
  },
  SaveBusinessDayRequest: {
    date: { required: true, example: "2026-12-16" },
    opensAt: { required: false, example: "10:00" },
    closesAt: { required: false, example: "16:00" },
    title: { required: false, maxLength: 128, example: "Инвентаризация" },
  },
  StockLineAnswerRequest: {
    lineId: { required: true },
    answer: { required: true },
  },
  StockResponseRequest: {
    comment: { required: false, maxLength: 1000 },
  },
  ReplyReviewRequest: {
    text: { required: true, maxLength: 2000, example: "Извините за задержку, машина стояла на посту" },
  },
  SaveTemplateRequest: {
    name: { required: true, maxLength: 255, example: "Еженедельный завоз" },
  },
  AskQuestionRequest: {
    itemId: { required: false },
    text: { required: true, maxLength: 2000, example: "Скидка от десяти мешков есть?" },
  },
  SubmitOrderRequest: {
    note: { required: false, maxLength: 1000, example: "позвоните за час" },
  },
  SubmitReviewRequest: {
    text: { required: false, maxLength: 2000, example: "Мешки целые, привезли вовремя" },
  },
  ActivateInvitationRequest: {
    code: { required: true, minLength: 1, example: "8f14e45fceea167a5a36dedd4bea2543" },
    consentVersion: { required: true, example: "2026-09-10" },
    password: { required: false, maxLength: 128 },
  },
  ReopenOrderRequest: {
    reason: { required: true, maxLength: 512 },
  },
  ReplyToCustomerRequest: {
    text: { required: true, maxLength: 2000, example: "Доставка на Абая 15 завтра после обеда, 2 000 ₸. Подходит?" },
  },
  AnswerQuestionRequest: {
    text: { required: true, maxLength: 2000 },
  },
  AssignDraftRequest: {
    expectedAssigneeId: { required: false },
  },
  AnswerInquiryRequest: {
    text: { required: true, maxLength: 2000, example: "Есть на складе, отгрузим завтра до обеда" },
  },
  DeliveryZoneRequest: {
    name: { required: true, maxLength: 255, example: "Ближняя" },
    description: { required: false, maxLength: 512, example: "в пределах города" },
  },
  DeliveryTimeSlotRequest: {
    fromTime: { required: true, example: "09:00:00" },
    toTime: { required: true, example: "13:00:00" },
  },
  IssueInvitationRequest: {
    phone: { required: true, pattern: /^(?:7\d{10})$/, minLength: 1, example: "77010000001" },
    email: { required: true, maxLength: 255, format: "email", example: "prorab@example.kz" },
    name: { required: false, maxLength: 255, example: "Асхат" },
  },
  AddItemMediaRequest: {
    kind: { required: true },
    url: { required: true, maxLength: 2048, example: "https://drive.google.com/file/d/1AbC_dEfG-42/view?usp=sharing" },
    title: { required: false, maxLength: 255, example: "Мешок 50 кг" },
  },
  ApplyIndustryRequest: {

  },
  CommitImportRequest: {

  },
  SaveFieldRequest: {
    code: { required: true, pattern: /^(?:^[A-Za-z][A-Za-z0-9_]{0,63}$)$/, maxLength: 64, example: "SEASON" },
    name: { required: true, maxLength: 120, example: "Сезон" },
    type: { required: true },
    unit: { required: false, maxLength: 16, example: "л" },
  },
  ExchangeMappingRequest: {
    externalCode: { required: true, maxLength: 128, example: "a3b4-size" },
    fieldId: { required: false },
  },
  SaveExchangeMappingsRequest: {

  },
  PromoteAttributeRequest: {
    attributeName: { required: true, maxLength: 60, example: "Цвет" },
    code: { required: true, pattern: /^(?:^[A-Za-z][A-Za-z0-9_]{0,63}$)$/, maxLength: 64, example: "COLOR" },
    type: { required: true },
  },
} as const satisfies Record<string, Record<string, FieldRule>>;
