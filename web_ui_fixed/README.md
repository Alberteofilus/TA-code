# SPP OCR System

Web interface untuk DeepSeek OCR + IndoBERT ekstraksi data pembayaran SPP.

## Tech Stack
- **Backend**: Flask + SQLAlchemy
- **Database**: MySQL
- **AI**: DeepSeek OCR (lokal) + IndoBERT NER (lokal)
- **Frontend**: HTML/CSS/JS (no framework)

---

## Setup & Instalasi

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Setup MySQL
Buat database baru:
```sql
CREATE DATABASE ocr_spp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Konfigurasi .env
Edit file `.env` sesuai konfigurasi kamu:
```
SECRET_KEY=random-string-panjang
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password_kamu
MYSQL_DB=ocr_spp

DEEPSEEK_MODEL_PATH=./ai_models/deepseek_ocr
INDOBERT_MODEL_PATH=./ai_models/indobert
```

### 4. Taruh model AI di folder yang benar
```
ai_models/
├── deepseek_ocr/         ← Copy hasil download Kaggle ke sini
│   ├── config.json
│   ├── tokenizer.json
│   └── model.safetensors
└── indobert/             ← Copy model IndoBERT ke sini
    ├── config.json
    ├── tokenizer.json
    └── pytorch_model.bin
```

> Kalau folder model belum ada, app tetap bisa jalan dalam **mode dummy**
> (menggunakan data contoh untuk development).

### 5. Jalankan Flask
```bash
python app.py
```

Buka browser: `http://localhost:5000`

---

## Struktur Project
```
ocr_spp/
├── app.py                    # Entry point Flask
├── config.py                 # Konfigurasi app
├── .env                      # Environment variables (jangan di-commit!)
├── requirements.txt
├── ai_models/
│   ├── deepseek_ocr/         # Model DeepSeek OCR lokal
│   └── indobert/             # Model IndoBERT NER lokal
├── models/
│   ├── deepseek_ocr.py       # Wrapper DeepSeek OCR
│   └── indobert_ner.py       # Wrapper IndoBERT NER
├── routes/
│   ├── auth.py               # Login / Signup / Logout
│   ├── ocr.py                # Upload, proses, CRUD API
│   └── main.py               # Halaman dashboard & records
├── database/
│   └── models.py             # SQLAlchemy models (User, OCRRecord)
├── templates/
│   ├── base.html
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html        # Main page: upload + hasil OCR
│   └── records.html          # Riwayat + CRUD data
└── static/
    ├── css/style.css
    ├── js/main.js             # Logic dashboard
    └── js/records.js          # Logic halaman records
```

---

## Menyesuaikan Model AI

### DeepSeek OCR (`models/deepseek_ocr.py`)
Sesuaikan bagian inferensi dengan arsitektur model kamu:
```python
# Baris ~55: sesuaikan cara load model
from transformers import AutoProcessor, AutoModelForVision2Seq

# Baris ~65: sesuaikan cara inferensi
inputs = self.processor(images=image, return_tensors="pt")
outputs = self.model.generate(**inputs, max_new_tokens=512)
```

### IndoBERT NER (`models/indobert_ner.py`)
Sesuaikan label NER dengan label training kamu:
```python
# Baris ~65: sesuaikan label
if label == "TANGGAL":      # ganti sesuai label training
    result["tanggal_pembayaran"] = value
elif label == "NAMA":        # ganti sesuai label training
    result["nama"] = value
# dst...
```

---

## API Endpoints

| Method | URL | Deskripsi |
|--------|-----|-----------|
| POST | `/api/upload` | Upload & proses OCR gambar |
| PUT | `/api/record/<id>` | Update data record |
| DELETE | `/api/record/<id>` | Hapus record |
| GET | `/api/records` | Ambil list records (pagination + search) |
| GET | `/api/export` | Export ke Excel (.xlsx) |
