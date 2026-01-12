FROM node:20-bullseye

# Install FFmpeg and Python dependencies (required for video processing and TTS)
RUN apt-get update && \
    apt-get install -y ffmpeg python3-pip && \
    pip3 install dashscope oss2 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (package-lock.json exists, using npm ci)
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npx next build --webpack

# Expose port 3000
EXPOSE 3000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
