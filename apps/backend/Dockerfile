FROM golang:1.26-alpine AS base
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download



FROM base AS development
# Устанавливаем air для hot-reload
RUN go install github.com/air-verse/air@latest
COPY . .
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]



FROM base AS builder
COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/api ./cmd/api/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/migrate ./cmd/migrate/main.go




FROM alpine:3.19 AS production
WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/api /app/api
COPY --from=builder /app/migrate /app/migrate

EXPOSE 8080
CMD ["/app/api"]
