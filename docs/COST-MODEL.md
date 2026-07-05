# Cost Model — Lingora

Estimasi biaya provider AI untuk operasional closed beta. Angka default **bukan invoice resmi** — kalibrasi wajib setelah data Kie/Midtrans tersedia.

## Sumber data

Semua usage tercatat di `usage_logs`:

| Type       | Trigger                        |
| ---------- | ------------------------------ |
| `CHAT`     | Setiap AI reply sukses         |
| `STT`      | Setiap transcribe sukses       |
| `TTS`      | Setiap synthesize sukses       |
| `SPEAKING` | Menit estimasi dari audio/text |

## Rate default (USD)

| Env                            | Default | Asumsi                  |
| ------------------------------ | ------- | ----------------------- |
| `COST_USD_PER_CHAT`            | 0.002   | ~1 chat completion      |
| `COST_USD_PER_STT`             | 0.004   | ~1 STT job              |
| `COST_USD_PER_TTS`             | 0.003   | ~1 TTS job              |
| `COST_USD_PER_SPEAKING_MINUTE` | 0.001   | Overhead pipeline suara |

Override di `.env` setelah bandingkan invoice provider.

## Akses laporan

### API (admin)

```http
GET /api/v1/admin/metrics?days=30
GET /api/v1/admin/costs?days=30
Header: X-Admin-Key: <ADMIN_API_KEY>
```

Non-production: tanpa key jika `ADMIN_API_KEY` belum diset.

Response mencakup:

- `usageTotals` — agregat all-time
- `costBreakdown` — per tipe + total USD
- `costByPlan` — exposure per paket (FREE vs paid)
- `dailyTrend` — biaya harian (N hari terakhir)
- `topSpenders` — user dengan estimasi biaya tertinggi
- `insights` — projected monthly, dominant driver, avg per active user

### CLI

```powershell
cd lingora-be
npm run admin:cost-review
npm run admin:cost-review -- 14   # 14 hari trend
```

## Kalibrasi (setelah beta awal)

1. Export usage 7 hari dari DB atau `/admin/costs`
2. Bandingkan total estimasi vs invoice Kie
3. Hitung faktor: `actual / estimated`
4. Update env rates atau dokumentasikan multiplier

Contoh:

```
Invoice Kie 7 hari = $12.40
Estimasi Lingora   = $8.20
Multiplier         = 1.51
→ COST_USD_PER_CHAT = 0.002 * 1.51 ≈ 0.003
```

## Metrik operasional

| Metrik                    | Interpretasi                                     |
| ------------------------- | ------------------------------------------------ |
| `freePlanCostUsd`         | Subsidi ke user FREE — pantau agar tidak melebar |
| `avgCostPerActiveUserUsd` | Unit economics per user aktif                    |
| `projectedMonthlyCostUsd` | Proyeksi dari rata-rata 7 hari terakhir          |
| `dominantCostDriver`      | chat / stt / tts / speaking — fokus optimasi     |

## Guardrails bisnis (sudah ada)

- Quota FREE: 10 menit speaking, 20 AI replies/hari
- Rate limit per IP di middleware
- Upgrade path via subscription foundation

## Alert threshold (rekomendasi manual)

Saat closed beta, cek mingguan:

- `projectedMonthlyCostUsd` > budget → review top spenders + quota FREE
- Single user > $X/bulan → investigasi abuse
- FREE plan > 70% total cost → pertimbangkan tighten quota atau onboarding cap
