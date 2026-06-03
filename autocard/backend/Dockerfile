# Stage 1: Build the Go binary
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install git and certificates
RUN apk add --no-cache git ca-certificates

# Copy dependency files and download
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the binary with static linking
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server main.go

# Stage 2: Final lightweight runner image
FROM alpine:latest  
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server .

# Expose port
EXPOSE 8080

# Run the server
CMD ["./server"]
