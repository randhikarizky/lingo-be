# Lingora Backend

REST API server untuk platform Lingora (Multo).

## Quick Start

### 1. PostgreSQL (Docker)

```bash
npm run db:up
```

PostgreSQL akan berjalan di `localhost:5432`.

### 2. Environment

```bash
cp .env.example .env
```

Isi credential Kie AI dan AWS S3 di `.env`.

### 3. Database Migration

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Jalankan Server

```bash
npm run dev
```

API tersedia di `http://localhost:3001`.

## PostgreSQL — Bantuan Setup

### Cek apakah Docker berjalan

```bash
docker ps
```

### Cek koneksi database

```bash
npx prisma studio
```

### Reset database (hati-hati, hapus semua data)

```bash
npx prisma migrate reset
```

### Tanpa Docker (PostgreSQL manual)

1. Install PostgreSQL 16
2. Buat user dan database:

```sql
CREATE USER lingora WITH PASSWORD 'lingora_secret';
CREATE DATABASE lingora_dev OWNER lingora;
```

3. Set `DATABASE_URL` di `.env`

## Mock Mode (tanpa API key)

Jika `KIE_AI_API_KEY` dan credential AWS masih placeholder, backend otomatis pakai **dummy mode**:

| Service | Perilaku dummy |
|---------|----------------|
| **Kie AI** | Balasan teks contoh dengan prefix `[MOCK AI]` |
| **AWS S3** | File disimpan lokal di `.local-storage/` |
| **STT** | Mengembalikan teks contoh |
| **TTS** | Menyimpan file teks placeholder |

Cek status mock:

```bash
curl http://localhost:3001/api/v1/health
# Response: { "mock": { "ai": true, "storage": true } }
```

Saat credential asli sudah tersedia, isi `.env` lalu set:

```env
MOCK_AI=false
MOCK_STORAGE=false
```

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/v1/health` | Health check + status mock |
| POST | `/api/v1/auth/register` | Registrasi |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | User saat ini |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/ai/chat` | Chat via Kie AI (atau mock) |
| POST | `/api/v1/speech/transcribe` | STT upload multipart (mock) |
| POST | `/api/v1/speech/synthesize` | TTS (atau mock) |
| GET | `/api/v1/storage/local/*` | Serve file lokal (mock storage) |

### `POST /api/v1/speech/transcribe`

**Content-Type:** `multipart/form-data`  
**Auth:** cookie `lingora_token` (login dulu)

| Field | Wajib | Keterangan |
|-------|-------|------------|
| `audio` | Ya | File rekaman (`audio/webm`, `audio/mp4`, dll., maks. 10MB) |
| `language` | Tidak | Locale STT, mis. `en-US` — menentukan teks mock |
| `conversationId` | Tidak | ID sesi percakapan dari client |

**Response `data`:**

```json
{
  "transcript": "Hello, I would like to practice my English speaking skills today.",
  "mock": true,
  "message": "STT dummy — audio diterima, mengembalikan teks contoh..."
}
```

**Contoh (setelah login, simpan cookie):**

```bash
curl -X POST http://localhost:4626/api/v1/speech/transcribe \
  -b "lingora_token=<JWT>" \
  -F "audio=@recording.webm;type=audio/webm" \
  -F "language=en-US" \
  -F "conversationId=$(uuidgen)"
```

## Demo Account (setelah seed)

- Email: `demo@lingora.app`
- Password: `password123`
