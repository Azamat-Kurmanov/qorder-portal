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
  ChooseStorageRequest: {
    provider: { required: true },
  },
  UpdateStaffRolesRequest: {

  },
  MediaLinkRequest: {
    url: { required: true, maxLength: 2048, example: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing" },
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
    logoUrl: { required: false, pattern: /^(?:^\s*$|^https:\/\/\S+$|^\/api\/files\/[0-9a-fA-F-]{36}$)$/, maxLength: 2048, example: "https://cdn.example.kz/stroybaza.png" },
    bankName: { required: false, maxLength: 255, example: "АО «Народный Банк Казахстана»" },
    bankBic: { required: false, maxLength: 16, example: "HSBKKZKX" },
    bankAccount: { required: false, pattern: /^(?:^\s*$|^KZ\d{2}[0-9A-Z]{16}$)$/, maxLength: 34, example: "KZ123456789012345678" },
    bankKbe: { required: false, pattern: /^(?:^\s*$|^\d{2}$)$/, example: "17" },
    goodsVatMode: { required: false, pattern: /^(?:INCLUDED|ON_TOP)$/, example: "INCLUDED" },
  },
  SaveRoleRequest: {
    name: { required: true, maxLength: 64, example: "Старший кладовщик" },
  },
  TenantDetailsRequest: {
    name: { required: true, minLength: 1, example: "ТОО Поставщик" },
    binIin: { required: false, pattern: /^(?:\d{12}|)$/, example: "210840005678" },
  },
  SetTenantTariffRequest: {
    tariff: { required: true, minLength: 1, example: "BUSINESS" },
  },
  SetTenantStatusRequest: {
    status: { required: true, example: "SUSPENDED" },
  },
  SetTenantOwnerRequest: {
    userId: { required: true },
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
  UpdateReferralRequest: {
    status: { required: true },
    tenantId: { required: false },
    note: { required: false, maxLength: 500 },
  },
  SavePaymentBankRequest: {
    country: { required: true, pattern: /^(?:^[A-Z]{2}$)$/, minLength: 1, example: "KZ" },
    code: { required: true, pattern: /^(?:^[A-Z0-9_]{2,20}$)$/, minLength: 1, example: "HALYK" },
    name: { required: true, maxLength: 60, example: "Halyk" },
  },
  UpdateWhatsappPackageRequest: {

  },
  UpdateMessengerRulesRequest: {

  },
  SaveMessageTemplateRequest: {

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
    motion: { required: false, example: "LIVELY" },
    slideTransition: { required: false, example: "WIPE" },
    pattern: { required: false, example: "FOOD" },
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
  SaveWarehouseRequest: {
    name: { required: true, maxLength: 255 },
    address: { required: false, maxLength: 500, example: "Алматы, ул. Райымбека, 212" },
  },
  SaveFloorRequest: {

  },
  SaveStorageUnitRequest: {
    kind: { required: true },
    code: { required: true, maxLength: 16, example: "A" },
  },
  SaveKeeperRequest: {

  },
  SaveDocumentRequest: {
    type: { required: true },
    warehouseId: { required: true },
    targetWarehouseId: { required: false },
    comment: { required: false, maxLength: 512 },
  },
  SaveCellRequest: {
    purpose: { required: true },
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
    animation: { required: false },
  },
  SaveQuickReplyRequest: {
    stage: { required: false },
    text: { required: true, maxLength: 500 },
  },
  ReorderQuickRepliesRequest: {

  },
  RegisterDeviceRequest: {
    token: { required: true, maxLength: 512 },
    platform: { required: true },
  },
  SaveSupplierRequest: {
    name: { required: true, maxLength: 255 },
    direction: { required: true },
    contact: { required: false, maxLength: 255 },
    note: { required: false, maxLength: 1000 },
    currency: { required: true },
  },
  SavePurchaseRequest: {
    supplierId: { required: true },
    direction: { required: false },
    supplierNumber: { required: false, maxLength: 64 },
    title: { required: true, maxLength: 255 },
    documentDate: { required: true },
    currency: { required: true },
    status: { required: true },
  },
  SaveShipmentRequest: {
    shippedOn: { required: true },
    placesText: { required: false, maxLength: 64 },
    note: { required: false, maxLength: 500 },
  },
  SavePlaceRequest: {
    kind: { required: true, maxLength: 16 },
    number: { required: false, maxLength: 32 },
    description: { required: false, maxLength: 255 },
  },
  SaveLineRequest: {
    supplierArticle: { required: false, maxLength: 64 },
    name: { required: false, maxLength: 255 },
    unit: { required: true, minLength: 1 },
  },
  SaveSizesRequest: {

  },
  LinkLineRequest: {
    itemId: { required: false },
  },
  SaveExpenseRequest: {
    kind: { required: true },
    currency: { required: true },
    note: { required: false, maxLength: 500 },
  },
  SaveBatchRequest: {
    kind: { required: false, maxLength: 16 },
    carrier: { required: false, maxLength: 255 },
    clientCode: { required: false, maxLength: 64 },
    route: { required: false, maxLength: 255 },
    periodFrom: { required: false },
    periodTo: { required: false },
    currency: { required: true },
    note: { required: false, maxLength: 500 },
  },
  SavePromoSettingsRequest: {
    saleTitle: { required: false, maxLength: 60, example: "Осенняя распродажа верхней одежды" },
    saleText: { required: false, maxLength: 200 },
    saleStartsOn: { required: false, example: "2026-09-20" },
    saleEndsOn: { required: false, example: "2026-09-30" },
  },
  PromoMarkRequest: {

  },
  PromoItemRequest: {

  },
  ItemDiscountExclusionsRequest: {

  },
  NoveltyPeriodRequest: {
    startsOn: { required: true, example: "2026-10-22" },
    endsOn: { required: true, example: "2026-11-05" },
  },
  UpdateTemplateRequest: {
    name: { required: true, maxLength: 255, example: "Еженедельный завоз" },
  },
  TemplateScheduleRequest: {
    kind: { required: true, pattern: /^(?:WEEKLY|MONTHLY)$/, example: "WEEKLY" },
    time: { required: true, example: "09:00" },
  },
  PromoSubscriptionRequest: {

  },
  RateOrderRequest: {
    reason: { required: false },
    comment: { required: false, maxLength: 1000, example: "Привезли на день позже" },
  },
  SetPortalLanguageRequest: {
    language: { required: true, pattern: /^(?:ru|kk|en)$/, example: "kk" },
  },
  SetCartLineRequest: {
    mode: { required: false },
  },
  TrackingRequest: {
    trackingNumber: { required: false, maxLength: 64, example: "AB123456" },
  },
  LineWarehouseRequest: {
    warehouseId: { required: true },
  },
  ExchangeSettingsRequest: {
    invoiceSource: { required: true, pattern: /^(?:INTERNAL|EXTERNAL_1C)$/, example: "EXTERNAL_1C" },
  },
  LinkItemCodeRequest: {
    code: { required: true, maxLength: 64, example: "00-000012391" },
  },
  UpdateDraftRequest: {
    customerName: { required: false },
    deliveryAddress: { required: false },
    deliveryDate: { required: false },
  },
  TransportReceiptRequest: {
    payee: { required: true, maxLength: 255, example: "ТОО «СДЭК-Казахстан»" },
    requisites: { required: false, maxLength: 1000 },
    payUrl: { required: false, pattern: /^(?:^https?:\/\/\S+$)$/, maxLength: 1000, example: "https://pay.example/abc" },
    number: { required: false, maxLength: 64, example: "К-10245" },
    dueDate: { required: false },
    comment: { required: false, maxLength: 1000 },
  },
  PickupPointRequest: {
    name: { required: true, maxLength: 255, example: "Склад на Рыскулова" },
    address: { required: true, maxLength: 512, example: "ул. Рыскулова 12" },
    workingHours: { required: false, maxLength: 255, example: "пн-сб 9:00-18:00" },
    opensAt: { required: false, example: "09:00:00" },
    closesAt: { required: false, example: "18:00:00" },
    warehouseId: { required: false },
  },
  DeliveryModeRequest: {
    mode: { required: true },
  },
  DeliveryMethodRequest: {
    name: { required: true, maxLength: 255, example: "Доставка по Алматы" },
    type: { required: true },
    tariffRule: { required: true },
    deliveryVatMode: { required: false },
    loadersVatMode: { required: false },
  },
  CarrierRequest: {
    name: { required: true, maxLength: 255, example: "СДЭК" },
    phone: { required: false, maxLength: 32, example: "+7 727 000 00 00" },
    trackingUrlTemplate: { required: false, pattern: /^(?:^https?:\/\/\S*\{number}\S*$)$/, maxLength: 512, example: "https://cdek.kz/track?n={number}" },
    terminalAddress: { required: false, maxLength: 512, example: "Алматы, Толе би 101" },
    note: { required: false, maxLength: 512, example: "Звонят за час до приезда" },
  },
  ReorderRunStopsRequest: {

  },
  SetCustomerManagerRequest: {
    managerId: { required: false },
  },
  SaveCustomerPriceTermRequest: {
    scope: { required: true },
    itemId: { required: false },
    categoryId: { required: false },
    validUntil: { required: false },
  },
  DebtInstallmentRequest: {
    dueDate: { required: true, example: "2026-11-20" },
  },
  DebtPlanRequest: {

  },
  SaveCustomerCreditRequest: {

  },
  SetShopShowcaseRequest: {

  },
  SaveCatalogSettingsRequest: {

  },
  SaveSaleModeRequest: {
    saleMode: { required: true, example: "BOTH" },
  },
  SaveSellerUnitRequest: {
    name: { required: true, maxLength: 64, example: "ящик" },
    insideBase: { required: false, maxLength: 32, example: "шт" },
    insideUnitId: { required: false },
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
    article: { required: false, maxLength: 64, example: "LOW-CIT" },
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
    article: { required: false, maxLength: 64, example: "LOW-CIT" },
    ageRule: { required: false },
  },
  SetItemVisibilityRequest: {

  },
  SetPurchasePriceRequest: {

  },
  SetItemExpiryRequest: {
    shelfLifeUnit: { required: false },
    warnUnit: { required: false },
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
  SetCategoryImageRequest: {
    imageUrl: { required: false, maxLength: 2048, example: "https://drive.google.com/file/d/1AbC_dEfG-42/view" },
  },
  BulkVisibilityRequest: {

  },
  BulkCategoryRequest: {
    categoryId: { required: false },
  },
  SavingsNormRequest: {

  },
  CreateStaffRequest: {
    phone: { required: true, pattern: /^(?:7\d{10}|[1-689]\d{7,14})$/, minLength: 1, example: "77010000105" },
    name: { required: true, minLength: 1, example: "Асхат Каримов" },
    email: { required: true, minLength: 1, format: "email", example: "askhat@example.kz" },
  },
  CreateTenantAccountRequest: {
    phone: { required: true, pattern: /^(?:7\d{10}|[1-689]\d{7,14})$/, minLength: 1, example: "77010000201" },
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
    purpose: { required: false, pattern: /^(?:FULL|CODES)$/, example: "CODES" },
  },
  SaveBusinessDayRequest: {
    date: { required: true, example: "2026-12-16" },
    opensAt: { required: false, example: "10:00" },
    closesAt: { required: false, example: "16:00" },
    title: { required: false, maxLength: 128, example: "Инвентаризация" },
  },
  CreateSubstitutionRequest: {
    absentId: { required: true },
    substituteId: { required: true },
    reason: { required: true },
    from: { required: true, example: "2026-11-05" },
    until: { required: false, example: "2026-11-12" },
  },
  WriteOffLotRequest: {
    lotId: { required: true },
    warehouseId: { required: true },
    reason: { required: false, maxLength: 512 },
  },
  AssignLotRequest: {
    itemId: { required: true },
    warehouseId: { required: true },
    producedOn: { required: false },
    producedAt: { required: false },
    expiresOn: { required: false },
    expiresAt: { required: false },
  },
  FoundRequest: {
    warehouseId: { required: true },
    itemId: { required: true },
    cellId: { required: false },
  },
  ResolveConflictRequest: {
    decision: { required: true },
    reason: { required: false, maxLength: 512 },
  },
  CellMoveRequest: {
    fromCellId: { required: true },
    itemId: { required: true },
    toCellId: { required: false },
    targetWarehouseId: { required: false },
  },
  AdjustRequest: {
    itemId: { required: true },
    warehouseId: { required: true },
    reason: { required: false, maxLength: 512 },
  },
  StockLineAnswerRequest: {
    lineId: { required: true },
    answer: { required: true },
    restock: { required: false },
    restockDate: { required: false },
    substituteItemId: { required: false },
    note: { required: false, maxLength: 500 },
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
  SaveReceiptRequest: {
    shipmentId: { required: true },
    warehouseId: { required: true },
    receivedOn: { required: true },
  },
  RecostReceiptRequest: {

  },
  PostReceiptRequest: {

  },
  SavePaymentRequest: {
    paidOn: { required: true },
    note: { required: false, maxLength: 500 },
  },
  InvoiceImportRequest: {

  },
  NoveltyBatchRequest: {
    startsOn: { required: true, example: "2026-10-22" },
    endsOn: { required: true, example: "2026-11-05" },
  },
  SaveTemplateRequest: {
    name: { required: true, maxLength: 255, example: "Еженедельный завоз" },
  },
  CreateReferralRequest: {
    referrerName: { required: false, maxLength: 120, example: "ТОО \"Кафе Сауле\"" },
    label: { required: false, maxLength: 60, example: "Поставщик хлеба" },
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
    mode: { required: false },
  },
  PaymentReportRequest: {
    paymentRef: { required: false, maxLength: 64, example: "OP-7781" },
    paidAt: { required: false },
    comment: { required: false, maxLength: 1000 },
  },
  AskAboutOrderRequest: {
    text: { required: true, maxLength: 2000, example: "Можно забрать завтра после шести?" },
  },
  DeclineOrderRequest: {
    reason: { required: false, example: "PRICE" },
    comment: { required: false, maxLength: 500, example: "Нашёл дешевле" },
  },
  AnswerOrderRequest: {
    message: { required: false, maxLength: 2000, example: "Замену беру, если цвет тёмный" },
  },
  SupplierLeadRequest: {
    code: { required: false, maxLength: 32 },
    name: { required: true, maxLength: 255, example: "ТОО \"Хлеб\"" },
    binIin: { required: false, pattern: /^(?:\d{12})$/, example: "123456789012" },
    phone: { required: true, pattern: /^(?:\s*\+?[\s()\-]*(\d[\s()\-]*){8,15})$/, minLength: 1, example: "+7 701 612 22 05" },
    city: { required: false, maxLength: 100, example: "Алматы" },
    consentVersion: { required: true, maxLength: 32, example: "2026-10-20" },
  },
  ForwardReferralRequest: {
    sellerName: { required: true, maxLength: 120, example: "Ерлан" },
    sellerPhone: { required: true, pattern: /^(?:\s*\+?[\s()\-]*(\d[\s()\-]*){8,15})$/, minLength: 1, example: "+7 701 555 12 34" },
  },
  StaffJoinPasswordRequest: {
    password: { required: true, minLength: 8, maxLength: 128 },
  },
  SupplierSignupRequest: {
    name: { required: true, maxLength: 255, example: "ТОО \"Хлеб\"" },
    binIin: { required: true, pattern: /^(?:\d{12})$/, minLength: 1, example: "123456789012" },
    ownerName: { required: true, maxLength: 255, example: "Асхат" },
    phone: { required: true, pattern: /^(?:\s*\+?[\s()\-]*(\d[\s()\-]*){8,15})$/, minLength: 1, example: "+7 701 612 22 05" },
    email: { required: true, maxLength: 255, format: "email", example: "owner@example.kz" },
    consentVersion: { required: true, maxLength: 32, example: "2026-10-20" },
    ownerToken: { required: false, maxLength: 64 },
    referralCode: { required: false, maxLength: 32 },
  },
  SignupConfirmRequest: {
    token: { required: true, maxLength: 128 },
    password: { required: true, minLength: 8, maxLength: 128 },
  },
  AccessRequestRequest: {
    phone: { required: false, pattern: /^(?:^\+?\d{10,15}$)$/, example: "77011234567" },
    companyName: { required: true, maxLength: 255, example: "ТОО Кафе" },
    bin: { required: false, pattern: /^(?:^\d{12}$)$/, example: "123456789013" },
    city: { required: true, maxLength: 255, example: "Астана" },
    consentVersion: { required: true, maxLength: 32, example: "2026-10-14" },
  },
  JoinPasswordRequest: {
    password: { required: true, maxLength: 128 },
  },
  SubmitReviewRequest: {
    text: { required: false, maxLength: 2000, example: "Мешки целые, привезли вовремя" },
  },
  ActivateInvitationRequest: {
    code: { required: true, minLength: 1, example: "8f14e45fceea167a5a36dedd4bea2543" },
    consentVersion: { required: true, example: "2026-09-10" },
    password: { required: false, maxLength: 128 },
  },
  DebtClaimLineRequest: {
    orderLineId: { required: true },
  },
  DebtClaimRequest: {
    method: { required: false, example: "KASPI" },
    comment: { required: false, maxLength: 500, example: "Kaspi, чек 7781" },
    bank: { required: false, pattern: /^(?:^[A-Z0-9_]{2,20}$)$/, example: "HALYK" },
    bankTarget: { required: false, example: "CARD" },
  },
  CreateOrderReturnRequest: {
    reason: { required: true, maxLength: 500, example: "Клиент не подошёл цвет" },
  },
  ReopenOrderRequest: {
    reason: { required: true, maxLength: 512 },
  },
  ReceiveOrderPaymentRequest: {
    comment: { required: false, maxLength: 500, example: "наличными" },
    method: { required: false, example: "KASPI" },
    bank: { required: false, pattern: /^(?:^[A-Z0-9_]{2,20}$)$/, example: "HALYK" },
  },
  CancelOrderPaymentRequest: {
    reason: { required: true, maxLength: 500, example: "ошиблись суммой" },
  },
  LinkUnmatchedLineRequest: {
    itemId: { required: true },
  },
  RejectDebtClaimRequest: {
    reason: { required: true, maxLength: 500, example: "перевод не пришёл" },
  },
  IssueInvitationRequest: {
    phone: { required: true, pattern: /^(?:7\d{10}|[1-689]\d{7,14})$/, minLength: 1, example: "77010000001" },
    email: { required: false, maxLength: 255, format: "email", example: "prorab@example.kz" },
    name: { required: false, maxLength: 255, example: "Асхат" },
  },
  HandoverRequest: {
    fromId: { required: true },
  },
  CreateManagerDraftRequest: {
    phone: { required: false, pattern: /^(?:7\d{10}|[1-689]\d{7,14})$/, example: "77010000312" },
    name: { required: false, maxLength: 255, example: "Ерлан" },
    pickupPointId: { required: false },
  },
  PaymentRejectRequest: {
    reason: { required: true, maxLength: 512, example: "Платёж не найден" },
  },
  StockRequestCreateRequest: {
    note: { required: false, maxLength: 1000, example: "Клиентке нужно к пятнице. Если блузки нет в 44 — спросите про 46" },
  },
  SendDraftRequest: {
    text: { required: false, maxLength: 4000 },
  },
  ReplyToCustomerRequest: {
    text: { required: true, maxLength: 2000, example: "Доставка на Абая 15 завтра после обеда, 2 000. Подходит?" },
  },
  RenegotiateRequest: {
    note: { required: false, maxLength: 500, example: "Есть аналог, по посадке ближе всего" },
  },
  AnswerQuestionRequest: {
    text: { required: true, maxLength: 2000 },
  },
  CustomerDecisionRequest: {
    decision: { required: true, example: "ACCEPT" },
  },
  CreditOverrideRequest: {
    reason: { required: true, maxLength: 500, example: "Клиент платит в пятницу" },
  },
  CreditDecisionRequest: {

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
  CreateDeliveryRunRequest: {
    date: { required: true, example: "2026-10-26" },
    driverId: { required: true },
  },
  DeliverStopRequest: {
    code: { required: true, maxLength: 32, example: "4821" },
  },
  ReceiveCustomerPaymentRequest: {
    method: { required: true, example: "KASPI" },
    comment: { required: false, maxLength: 500 },
    bank: { required: false, pattern: /^(?:^[A-Z0-9_]{2,20}$)$/, example: "HALYK" },
  },
  AcceptReferralRequest: {
    referralCode: { required: false, maxLength: 64, example: "k3J9xQ" },
    ownerToken: { required: false, maxLength: 64 },
  },
  CabinetOfferAnswerRequest: {

  },
  DeclineAccessRequest: {
    reason: { required: false, maxLength: 500, example: "Работаем только с Астаной" },
  },
  AddItemMediaRequest: {
    kind: { required: true },
    url: { required: true, maxLength: 2048, example: "https://drive.google.com/file/d/1AbC_dEfG-42/view?usp=sharing" },
    title: { required: false, maxLength: 255, example: "Мешок 50 кг" },
  },
  AddBarcodeRequest: {
    code: { required: true, pattern: /^(?:\s*[0-9A-Za-z\-._]+\s*)$/, maxLength: 48, example: "4870000000017" },
  },
  GenerateBarcodeRequest: {

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
