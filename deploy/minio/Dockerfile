# Upstream MinIO registries no longer serve these community images.
# Build pinned upstream sources for the native Docker architecture instead.
FROM --platform=$BUILDPLATFORM golang:1.24.7-bookworm AS mc-build
ARG TARGETARCH
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
RUN git clone --depth 1 --branch RELEASE.2025-08-13T08-35-41Z https://github.com/minio/mc.git /src/mc
WORKDIR /src/mc
RUN GOOS=linux GOARCH=$TARGETARCH go build -trimpath -o /out/mc .

FROM --platform=$BUILDPLATFORM golang:1.24.7-bookworm AS minio-build
ARG TARGETARCH
ARG MINIO_RELEASE
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
RUN test -n "$MINIO_RELEASE" && git clone --depth 1 --branch "$MINIO_RELEASE" https://github.com/minio/minio.git /src/minio
WORKDIR /src/minio
RUN GOOS=linux GOARCH=$TARGETARCH go build -trimpath -o /out/minio .

FROM alpine:3.22.1
RUN apk add --no-cache ca-certificates curl
COPY --from=minio-build /out/minio /usr/bin/minio
COPY --from=mc-build /out/mc /usr/bin/mc
COPY --from=minio-build /src/minio/LICENSE /licenses/minio-LICENSE
COPY --from=mc-build /src/mc/LICENSE /licenses/mc-LICENSE
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
