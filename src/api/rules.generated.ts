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
    city: { required: false, maxLength: 100, example: "Алматы" },
    contact: { required: false, maxLength: 128, example: "+7 727 000 00 00" },
    phone: { required: false, maxLength: 32, example: "+7 701 000 00 01" },
    whatsapp: { required: false, maxLength: 32, example: "+7 701 000 00 01" },
    tagline: { required: false, maxLength: 64, example: "Магазин одежды" },
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
  SetTenantStatusRequest: {
    status: { required: true, example: "SUSPENDED" },
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
  UpdateMyProfileRequest: {
    name: { required: true, pattern: /^(?:^(?=.*[\p{L}\p{N}])[^<>&"'$%!#?§;*~/\\|^=\[\]{}()\p{Cc}]+$)$/u, maxLength: 100, example: "Асхат Курманов" },
  },
  UpdateGeneralSettingsRequest: {
    currency: { required: true, example: "KZT" },
    workspaceColor: { required: false, pattern: /^(?:^\s*$|^\s*#[0-9A-Fa-f]{6}\s*$)$/, example: "#1F5C57" },
    workspaceBackground: { required: false, example: "SAND" },
  },
  SaveCabinetDesignRequest: {
    template: { required: true, example: "VITRINA" },
    brandColor: { required: false, pattern: /^(?:^\s*$|^\s*#[0-9A-Fa-f]{6}\s*$)$/, example: "#1F5C57" },
    background: { required: false, example: "SAND" },
    theme: { required: true, example: "TEMPLATE" },
    occasion: { required: false, example: "NAURYZ" },
    occasionFrom: { required: false, example: "2027-03-14" },
    occasionUntil: { required: false, example: "2027-03-23" },
  },
  BusinessDayHoursRequest: {
    opensAt: { required: false, example: "09:00" },
    closesAt: { required: false, example: "18:00" },
    breakStart: { required: false, example: "13:00" },
    breakEnd: { required: false, example: "14:00" },
  },
  UpdateBusinessHoursRequest: {
    timezone: { required: false, maxLength: 64, example: "Asia/Almaty" },
  },
  SaveShowcaseBannersRequest: {

  },
  ShowcaseBannerRequest: {
    id: { required: false },
    template: { required: true },
    scheme: { required: true },
    badge: { required: false, maxLength: 34, example: "Новинка" },
    title: { required: true, maxLength: 44, example: "Юбка миди Pleated — уже в магазине" },
    text: { required: false, maxLength: 110 },
    buttonText: { required: true, maxLength: 26, example: "Посмотреть новинки" },
    discount: { required: false, maxLength: 5, example: "−20%" },
    discountNote: { required: false, maxLength: 22, example: "от 400 000 ₸ в заявке" },
    imageUrl: { required: false, maxLength: 2048, example: "https://cdn.example.kz/lookbook/pleated-skirt.jpg" },
    imageItemId: { required: false },
    target: { required: true },
    targetCategoryId: { required: false },
    targetItemId: { required: false },
    showFrom: { required: false, example: "2026-09-23" },
    showUntil: { required: false, example: "2026-09-30" },
  },
  SaveQuickReplyRequest: {
    stage: { required: false },
    text: { required: true, maxLength: 500 },
  },
  ReorderQuickRepliesRequest: {

  },
  SavePromoSettingsRequest: {
    saleTitle: { required: false, maxLength: 60, example: "Осенняя распродажа верхней одежды" },
    saleText: { required: false, maxLength: 200 },
    saleStartsOn: { required: false, example: "2026-09-20" },
    saleEndsOn: { required: false, example: "2026-09-30" },
    subscriptionPromise: { required: false },
  },
  PromoMarkRequest: {

  },
  PromoItemRequest: {

  },
  ItemDiscountExclusionsRequest: {

  },
  PromoSubscriptionRequest: {

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
    opensAt: { required: false, example: "09:00:00" },
    closesAt: { required: false, example: "18:00:00" },
  },
  DeliveryModeRequest: {
    mode: { required: true },
  },
  DeliveryMethodRequest: {
    name: { required: true, maxLength: 255, example: "Доставка по Алматы" },
    type: { required: true },
    tariffRule: { required: true },
  },
  SaveCatalogSettingsRequest: {

  },
  SaveSaleModeRequest: {
    saleMode: { required: true, example: "BOTH" },
  },
  SavePressRequest: {

  },
  SaveSellerUnitRequest: {
    name: { required: true, maxLength: 64, example: "ящик" },
  },
  ReorderSellerUnitsRequest: {

  },
  SetPricesRequest: {

  },
  BulkPriceRequest: {
    direction: { required: true },
    unit: { required: true },
  },
  ModelVariantRowRequest: {
    itemId: { required: false },
    size: { required: true, maxLength: 120, example: "S42" },
    sku: { required: false, maxLength: 64, example: "K-42" },
  },
  SaveModelVariantsRequest: {

  },
  ReorderItemMediaRequest: {

  },
  PackLineRequest: {
    itemId: { required: true, example: "018f3c2a-7b4e-7c1a-9f2d-3b5e6a7c8d90" },
  },
  SaveCatalogItemRequest: {
    sku: { required: false, maxLength: 64, example: "CEM-400" },
    name: { required: true, maxLength: 512, example: "Цемент М-400" },
    unit: { required: true, maxLength: 64, example: "мешок" },
    description: { required: false, maxLength: 4000, example: "Влагостойкая плита, 9 мм, лист 2500×1250" },
    categoryId: { required: false },
    storageLocation: { required: false, maxLength: 255, example: "Склад · ряд 2, полка 3" },
  },
  SetItemVisibilityRequest: {

  },
  FieldOptionRequest: {
    code: { required: true, pattern: /^(?:^[A-Za-z][A-Za-z0-9_]{0,63}$)$/, maxLength: 64, example: "WINTER" },
    name: { required: true, maxLength: 120, example: "Зима" },
    hex: { required: false, pattern: /^(?:^#[0-9A-Fa-f]{6}$)$/, example: "#1A1A1A" },
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
  BulkVisibilityRequest: {

  },
  BulkCategoryRequest: {
    categoryId: { required: false },
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
    restock: { required: false },
    restockDate: { required: false },
    substituteItemId: { required: false },
  },
  StockResponseRequest: {
    comment: { required: false, maxLength: 1000 },
  },
  StockMessageRequest: {
    text: { required: true, maxLength: 1000, example: "В 44 размере есть только молочная — подойдёт?" },
  },
  StockExtendRequest: {
    extension: { required: true },
  },
  ReplyReviewRequest: {
    text: { required: true, maxLength: 2000, example: "Извините за задержку, машина стояла на посту" },
  },
  RejectReviewRequest: {
    reason: { required: false, example: "SPAM" },
  },
  SaveTemplateRequest: {
    name: { required: true, maxLength: 255, example: "Еженедельный завоз" },
  },
  AskQuestionRequest: {
    itemId: { required: false },
    text: { required: true, maxLength: 2000, example: "Скидка от десяти мешков есть?" },
  },
  PendingInvitationRequest: {
    invitationId: { required: true },
    consentVersion: { required: false, maxLength: 32, example: "2026-09-01" },
  },
  SubmitOrderRequest: {
    note: { required: false, maxLength: 1000, example: "позвоните за час" },
  },
  AskAboutOrderRequest: {
    text: { required: true, maxLength: 2000, example: "Можно забрать завтра после шести?" },
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
  LinkUnmatchedLineRequest: {
    itemId: { required: true },
  },
  StockRequestCreateRequest: {
    note: { required: false, maxLength: 1000, example: "Клиентке нужно к пятнице. Если блузки нет в 44 — спросите про 46" },
  },
  ReplyToCustomerRequest: {
    text: { required: true, maxLength: 2000, example: "Доставка на Абая 15 завтра после обеда, 2 000. Подходит?" },
  },
  AnswerQuestionRequest: {
    text: { required: true, maxLength: 2000 },
  },
  AssignDraftRequest: {
    expectedAssigneeId: { required: false },
  },
  TransferDraftRequest: {
    assigneeId: { required: true },
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
  BulkItemsRequest: {

  },
  AddCatalogAliasRequest: {
    itemId: { required: true },
    text: { required: true, maxLength: 512, example: "брюки элеганс белые" },
  },
} as const satisfies Record<string, Record<string, FieldRule>>;
