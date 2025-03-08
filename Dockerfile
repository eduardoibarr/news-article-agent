# Stage 1: Dependências e Build
FROM node:18-alpine AS builder

WORKDIR /app

# Instalando ferramentas adicionais
RUN apk add --no-cache curl jq

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Imagem final
FROM node:18-alpine AS production

WORKDIR /app

# Instalando apenas as ferramentas necessárias para produção
RUN apk add --no-cache curl

# Criando usuário não-root
RUN addgroup -S appuser && adduser -S -G appuser appuser

# Copiar apenas os arquivos necessários para produção
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/nodemon.json ./
COPY --from=builder /app/.nodemonignore ./

# Instalar apenas dependências de produção
RUN npm ci --only=production

# Criar e ajustar permissões do diretório de dados
RUN mkdir -p data logs && \
    chown -R appuser:appuser /app

# Usar usuário não-root
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Definir variáveis de ambiente
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "dist/index.js"] 