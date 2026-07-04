# Stage 1: Compile LibreDWG (cached separately)
FROM alpine:latest AS libredwg-builder
RUN apk add --no-cache git autoconf automake libtool build-base texinfo flex bison gperf
RUN git clone --depth 1 https://github.com/LibreDWG/libredwg.git /libredwg
WORKDIR /libredwg
RUN ./autogen.sh && \
    ./configure --disable-python --disable-bindings && \
    make -j$(nproc) && \
    make install

# Stage 2: Build the Go binary
FROM golang:1.24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server main.go

# Stage 3: Final lightweight runner image
FROM alpine:latest  
RUN apk --no-cache add ca-certificates tzdata

# Copy LibreDWG binary and shared libraries
COPY --from=libredwg-builder /usr/local/bin/dwg2dxf /usr/local/bin/dwg2dxf
COPY --from=libredwg-builder /usr/local/lib/libredwg.so* /usr/local/lib/

# Set library search path for the shared library
ENV LD_LIBRARY_PATH=/usr/local/lib

WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
