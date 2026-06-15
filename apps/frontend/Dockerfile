# FROM node:20-alpine AS development-dependencies-env
# COPY . /app
# WORKDIR /app
# RUN npm ci

# FROM node:20-alpine AS production-dependencies-env
# COPY ./package.json package-lock.json /app/
# WORKDIR /app
# RUN npm ci --omit=dev

# FROM node:20-alpine AS build-env
# COPY . /app/
# COPY --from=development-dependencies-env /app/node_modules /app/node_modules
# WORKDIR /app
# RUN npm run build

# FROM node:20-alpine
# COPY ./package.json package-lock.json /app/
# COPY --from=production-dependencies-env /app/node_modules /app/node_modules
# COPY --from=build-env /app/build /app/build
# WORKDIR /app
# CMD ["npm", "run", "start"]

FROM node:20-alpine

WORKDIR /app

# Копируем package.json для кеша зависимостей
COPY package.json package-lock.json* ./
RUN npm install

# Копируем исходники
COPY . .

EXPOSE 5173

# Vite dev server, слушает на всех интерфейсах
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
