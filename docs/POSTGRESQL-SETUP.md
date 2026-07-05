# PostgreSQL Setup untuk Lingora

Panduan ini membantu Anda menjalankan database PostgreSQL di Windows.

---

## Opsi 1: Docker (paling mudah)

**Prasyarat:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
cd lingora-be
npm run db:up
```

Cek status:

```bash
docker ps
```

Connection string (sudah di `.env.example`):

```
postgresql://lingora:lingora_secret@localhost:5432/lingora_dev?schema=public
```

---

## Opsi 2: Install PostgreSQL Manual (Windows)

### Langkah 1 — Download & Install

1. Buka https://www.postgresql.org/download/windows/
2. Download **PostgreSQL 16** via EDB installer
3. Saat install, catat **password untuk user `postgres`**
4. Port default: **5432** (biarkan default)
5. Centang **pgAdmin 4** (GUI, opsional tapi membantu)

### Langkah 2 — Buat Database & User

Buka **SQL Shell (psql)** dari Start Menu, atau pgAdmin → Query Tool:

```sql
CREATE USER lingora WITH PASSWORD 'lingora_secret';
CREATE DATABASE lingora_dev OWNER lingora;
GRANT ALL PRIVILEGES ON DATABASE lingora_dev TO lingora;
```

### Langkah 3 — Set Environment

Copy dan edit `.env`:

```bash
cp .env.example .env
```

Pastikan `DATABASE_URL` sesuai:

```env
DATABASE_URL="postgresql://lingora:lingora_secret@localhost:5432/lingora_dev?schema=public"
```

### Langkah 4 — Jalankan Migration

```bash
npm run db:generate
npx prisma migrate dev --name init
npm run db:seed
```

### Langkah 5 — Verifikasi

```bash
npm run db:studio
```

Browser akan terbuka di `http://localhost:5555` — Anda bisa lihat tabel `users`, `conversations`, dll.

---

## Troubleshooting

| Masalah                          | Solusi                                                                |
| -------------------------------- | --------------------------------------------------------------------- |
| `Connection refused`             | Pastikan PostgreSQL service berjalan (Services → `postgresql-x64-16`) |
| `password authentication failed` | Cek username/password di `DATABASE_URL`                               |
| `database does not exist`        | Jalankan `CREATE DATABASE lingora_dev`                                |
| `Docker not recognized`          | Install Docker Desktop atau gunakan Opsi 2                            |
| Port 5432 sudah dipakai          | Ganti port di install atau di `docker-compose.yml`                    |

---

## Commands Berguna

```bash
npm run db:up        # Start PostgreSQL (Docker)
npm run db:down      # Stop PostgreSQL (Docker)
npm run db:migrate   # Apply migrations
npm run db:seed      # Seed demo user
npm run db:studio    # Open Prisma Studio GUI
```

Demo account setelah seed:

- Email: `demo@lingora.app`
- Password: `password123`
