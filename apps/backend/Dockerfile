FROM golang:1.26-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Устанавливаем air для hot-reload
RUN go install github.com/air-verse/air@latest

EXPOSE 8080

# Запускаем через air — автоматически перезагружается при изменении кода
CMD ["air", "-c", ".air.toml"]
