# Образ кабинета клиента: статика Vite, собранная заранее и отданная nginx.
#
# Свой образ и свой тег: у кабинета отдельная аудитория и отдельный релизный
# цикл, и выкатка рабочего места менеджера не должна тянуть за собой кабинет.

# ---------- стадия 1: сборка статики ----------

# Node тот же, на котором собирают кабинет руками: расхождение версий тулчейна
# обнаруживается отказом сборки в самый неудобный момент
FROM node:22-alpine AS build

WORKDIR /app

# Сначала только манифесты: слой с зависимостями переживает правку кода
# и не пересобирается на каждый коммит
COPY package.json package-lock.json ./

# ci, а не install: ставится ровно то, что записано в package-lock.json,
# и сборка одной и той же ревизии даёт один и тот же результат
RUN npm ci

COPY . .

# Адреса окружения приходят аргументами сборки. Vite подставляет import.meta.env
# на этапе сборки — в готовой статике переменной уже нет, и менять её в рантайме
# нечему. Поэтому разные стенды означают разные сборки, а не разный docker run.
#
# Пустой VITE_API_URL — не забытое значение: кабинет и API отдаются одним nginx,
# и относительный адрес избавляет от правила источников целиком.
ARG VITE_API_URL=""
ARG VITE_KEYCLOAK_URL="http://localhost:8081"
ARG VITE_KEYCLOAK_REALM="fastorders-customers"
ARG VITE_KEYCLOAK_CLIENT_ID="fastorders-portal"

ENV VITE_API_URL=$VITE_API_URL \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

# Сборка включает проверку типов: несобираемый кабинет обязан упасть здесь,
# а не встретить клиента белым экраном
RUN npm run build

# ---------- стадия 2: итоговый образ ----------

FROM nginx:alpine

# curl нужен пробе готовности из docker-compose.yml: в nginx:alpine его нет,
# и без него контейнер оставался бы «запущенным» при зависшем nginx.
# tzdata — иначе время в логах доступа схлопывается в UTC.
RUN apk add --no-cache curl tzdata

# Маршруты кабинета: раздача статики, возврат index.html и прокси на API
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Только результат сборки: ни node_modules, ни исходников в образе нет
COPY --from=build /app/dist /usr/share/nginx/html

# Отметка о порте; наружу его публикует docker-compose.yml
EXPOSE 80

# Форма-список: nginx становится процессом 1 и получает SIGTERM от docker напрямую
CMD [ "nginx", "-g", "daemon off;" ]
