FROM golang:1.25 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /almas ./cmd/almas-local

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
USER 65534:65534
COPY --from=build /almas /usr/local/bin/almas
ENTRYPOINT ["/usr/local/bin/almas"]
