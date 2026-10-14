FROM node:18-slim

# Puppeteer için gerekli bağımlılıkları yükleyin
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizinini ayarla
WORKDIR /app

# Bağımlılık dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle ve PM2'yi global olarak kur
RUN npm install
RUN npm install -g pm2

# Kaynak kodunu kopyala
COPY . .

# PM2 ile uygulamayı başlat
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
