"""
IndoBERT NER Wrapper
---------------------
Load model IndoBERT dari folder lokal untuk ekstraksi entitas.
Taruh file model kamu di: ./ai_models/indobert/

Label NER yang diharapkan (sesuaikan dengan label training kamu):
- TANGGAL     → tanggal_pembayaran  (output: date object YYYY-MM-DD)
- NAMA        → nama siswa
- KELAS       → kelas siswa
- SUBJEK      → subjek/mata pelajaran
- BULAN_SPP   → bulan pembayaran SPP
- NOMINAL     → jumlah nominal SPP
"""

import os
import re
from datetime import date


class IndoBERTExtractor:
    def __init__(self):
        self.nlp    = None
        self.loaded = False

    def load_model(self, model_path: str):
        """
        Load IndoBERT NER pipeline dari lokal.
        Dipanggil sekali saat Flask start.
        """
        if not os.path.exists(model_path):
            print(f"[IndoBERT] ⚠️  Folder model tidak ditemukan: {model_path}")
            print("[IndoBERT] ⚠️  Jalankan dalam mode DUMMY (untuk development)")
            self.loaded = False
            return

        try:
            from transformers import (
                AutoTokenizer,
                AutoModelForTokenClassification,
                pipeline
            )

            print(f"[IndoBERT] Loading model dari {model_path} ...")

            tokenizer = AutoTokenizer.from_pretrained(model_path)
            model     = AutoModelForTokenClassification.from_pretrained(model_path)

            self.nlp = pipeline(
                "ner",
                model=model,
                tokenizer=tokenizer,
                aggregation_strategy="simple"
            )

            self.loaded = True
            print("[IndoBERT] Model loaded ✓")

        except Exception as e:
            print(f"[IndoBERT] ❌ Gagal load model: {e}")
            self.loaded = False

    def extract_fields(self, raw_text: str) -> dict:
        """
        Input  : raw text dari DeepSeek OCR
        Output : dict field yang sudah diekstrak
        Kalau model belum diload → fallback ke regex parser
        """
        if not self.loaded:
            return self._regex_fallback(raw_text)

        try:
            entities = self.nlp(raw_text)
            result   = self._empty_result()

            for entity in entities:
                label = entity.get("entity_group", "")
                value = entity.get("word", "").strip()

                # ---- Sesuaikan label dengan hasil training kamu ----
                if label == "TANGGAL":
                    result["tanggal_pembayaran"] = self._parse_date(value)
                elif label == "NAMA":
                    result["nama"] = value
                elif label == "KELAS":
                    result["kelas"] = value
                elif label == "SUBJEK":
                    result["subjek"] = value
                elif label == "BULAN_SPP":
                    result["bulan_spp"] = value
                elif label == "NOMINAL":
                    result["nominal_spp"] = self._parse_nominal(value)

            return result

        except Exception as e:
            print(f"[IndoBERT] ❌ Error saat ekstraksi: {e}")
            return self._regex_fallback(raw_text)

    def _regex_fallback(self, text: str) -> dict:
        """
        Fallback parser menggunakan regex.
        Dipakai saat model belum tersedia atau gagal.
        """
        result = self._empty_result()

        patterns = {
            "tanggal_pembayaran": [
                r"[Tt]anggal\s*[:=]?\s*(.+)",
                r"(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})",
                r"(\d{1,2}\s+\w+\s+\d{4})",
            ],
            "nama": [
                r"[Nn]ama\s*[:=]?\s*(.+)",
                r"[Ss]iswa\s*[:=]?\s*(.+)",
            ],
            "kelas": [
                r"[Kk]elas\s*[:=]?\s*(.+)",
            ],
            "subjek": [
                r"[Ss]ubjek\s*[:=]?\s*(.+)",
                r"[Mm]ata [Pp]elajaran\s*[:=]?\s*(.+)",
            ],
            "bulan_spp": [
                r"[Bb]ulan\s*[:=]?\s*(.+)",
                r"SPP\s+[Bb]ulan\s*[:=]?\s*(.+)",
                r"[Pp]embayaran\s+SPP\s+[Bb]ulan\s*[:=]?\s*(.+)",
            ],
            "nominal_spp": [
                r"[Jj]umlah\s*[:=]?\s*([\w\s.,]+)",
                r"[Nn]ominal\s*[:=]?\s*([\w\s.,]+)",
                r"Rp\.?\s*([\d.,]+)",
                r"SPP\s*[:=]?\s*([\w\s.,]+)",
            ],
        }

        for field, pats in patterns.items():
            for pat in pats:
                match = re.search(pat, text)
                if match:
                    value = match.group(1).strip()
                    if field == "tanggal_pembayaran":
                        result[field] = self._parse_date(value)
                    elif field == "nominal_spp":
                        result[field] = self._parse_nominal(value)
                    else:
                        result[field] = value
                    break

        return result

    def _parse_date(self, value: str):
        """
        Konversi berbagai format tanggal ke date object.

        Format yang didukung:
          "10-6-2025"    → date(2025, 6, 10)
          "10/06/2025"   → date(2025, 6, 10)
          "10 Juni 2025" → date(2025, 6, 10)
          "2025-06-10"   → date(2025, 6, 10)  (sudah YYYY-MM-DD)

        Output disimpan ke DB sebagai DATE (2025-06-10)
        to_dict() akan format ke "10-06-2025" untuk UI
        """
        if not value:
            return None

        value = value.strip()

        # Format sudah YYYY-MM-DD
        match = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', value)
        if match:
            try:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except ValueError:
                pass

        # Format angka: DD-MM-YYYY atau DD/MM/YYYY
        match = re.match(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$', value)
        if match:
            try:
                return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
            except ValueError:
                pass

        # Format teks Indonesia: "10 Juni 2025" atau "10 jun 2025"
        bulan_map = {
            'januari': 1,  'jan': 1,
            'februari': 2, 'feb': 2,
            'maret': 3,    'mar': 3,
            'april': 4,    'apr': 4,
            'mei': 5,
            'juni': 6,     'jun': 6,
            'juli': 7,     'jul': 7,
            'agustus': 8,  'agu': 8,  'aug': 8,
            'september': 9,'sep': 9,
            'oktober': 10, 'okt': 10, 'oct': 10,
            'november': 11,'nov': 11,
            'desember': 12,'des': 12, 'dec': 12,
        }
        match = re.match(r'^(\d{1,2})\s+(\w+)\s+(\d{4})$', value.lower())
        if match:
            d   = int(match.group(1))
            m   = bulan_map.get(match.group(2), 0)
            y   = int(match.group(3))
            if m:
                try:
                    return date(y, m, d)
                except ValueError:
                    pass

        # Tidak bisa diparse → return None
        print(f"[IndoBERT] ⚠️  Tidak bisa parse tanggal: '{value}'")
        return None

    def _parse_nominal(self, value: str):
        """Bersihkan nominal: 'Rp 150.000' → 150000.0"""
        try:
            cleaned = re.sub(r'[Rp\s.,]', '', value)
            cleaned = re.sub(r'[^\d]', '', cleaned)
            return float(cleaned) if cleaned else None
        except Exception:
            return None

    def _empty_result(self) -> dict:
        return {
            "tanggal_pembayaran": None,   # date object atau None
            "nama":               None,
            "kelas":              None,
            "subjek":             None,
            "bulan_spp":          None,
            "nominal_spp":        None,
        }


# Singleton
indobert_extractor = IndoBERTExtractor()
