# """
# DeepSeek OCR Wrapper
# ---------------------
# Load model dari folder lokal hasil download Kaggle.
# Taruh file model kamu di: ./ai_models/deepseek_ocr/

# Isi folder yang dibutuhkan:
# - config.json
# - tokenizer.json / tokenizer_config.json
# - model.safetensors atau pytorch_model.bin
# - preprocessor_config.json (kalau ada)
# """

# import os
# import torch
# from PIL import Image

# class DeepSeekOCR:
#     def __init__(self):
#         self.model     = None
#         self.processor = None
#         self.loaded    = False

#     def load_model(self, model_path: str):
#         """
#         Load model dari lokal.
#         Dipanggil sekali saat Flask start.
#         """
#         if not os.path.exists(model_path):
#             print(f"[DeepSeekOCR] ⚠️  Folder model tidak ditemukan: {model_path}")
#             print("[DeepSeekOCR] ⚠️  Jalankan dalam mode DUMMY (untuk development)")
#             self.loaded = False
#             return

#         try:
#             # ---- Sesuaikan import dengan arsitektur model kamu ----
#             # Kalau DeepSeek VL (Vision-Language):
#             from transformers import AutoProcessor, AutoModelForVision2Seq

#             print(f"[DeepSeekOCR] Loading model dari {model_path} ...")

#             self.processor = AutoProcessor.from_pretrained(
#                 model_path,
#                 trust_remote_code=True   # diperlukan untuk model custom
#             )
#             self.model = AutoModelForVision2Seq.from_pretrained(
#                 model_path,
#                 trust_remote_code=True,
#                 torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
#                 device_map="auto"        # otomatis pakai GPU kalau ada
#             )

#             self.loaded = True
#             device = "GPU ✓" if torch.cuda.is_available() else "CPU"
#             print(f"[DeepSeekOCR] Model loaded → {device}")

#         except Exception as e:
#             print(f"[DeepSeekOCR] ❌ Gagal load model: {e}")
#             self.loaded = False

#     def extract_text(self, image_path: str) -> str:
#         """
#         Input  : path gambar (JPG/PNG)
#         Output : raw text hasil OCR

#         Kalau model belum diload → return dummy text untuk development
#         """
#         if not self.loaded:
#             return self._dummy_text()

#         try:
#             image = Image.open(image_path).convert("RGB")

#             # ---- Sesuaikan dengan cara inferensi model kamu ----
#             inputs = self.processor(images=image, return_tensors="pt")
#             inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

#             with torch.no_grad():
#                 outputs = self.model.generate(
#                     **inputs,
#                     max_new_tokens=512,
#                     do_sample=False
#                 )

#             raw_text = self.processor.decode(outputs[0], skip_special_tokens=True)
#             return raw_text

#         except Exception as e:
#             print(f"[DeepSeekOCR] ❌ Error saat OCR: {e}")
#             return ""

#     def _dummy_text(self) -> str:
#         """Dummy output untuk development tanpa model"""
#         return (
#             "Tanggal: 15 Januari 2025\n"
#             "Nama: Budi Santoso\n"
#             "Kelas: X IPA 1\n"
#             "Subjek: Matematika\n"
#             "Pembayaran SPP Bulan: Januari 2025\n"
#             "Jumlah: Rp 150.000"
#         )

# # Singleton — load sekali, pakai berkali-kali
# deepseek_ocr = DeepSeekOCR()


"""
DeepSeek OCR Wrapper
---------------------
Load model dari folder lokal hasil download Kaggle.
Taruh file model kamu di: ./ai_models/deepseek_ocr/

Isi folder yang dibutuhkan:
- config.json
- tokenizer.json / tokenizer_config.json
- model.safetensors atau pytorch_model.bin
- preprocessor_config.json (kalau ada)
"""

import os

class DeepSeekOCR:
    def __init__(self):
        self.model     = None
        self.processor = None
        self.loaded    = False

    def load_model(self, model_path: str):
        """
        Load model dari lokal.
        Dipanggil sekali saat Flask start.
        """
        if not os.path.exists(model_path):
            print(f"[DeepSeekOCR] ⚠️  Folder model tidak ditemukan: {model_path}")
            print("[DeepSeekOCR] ⚠️  Jalankan dalam mode DUMMY (untuk development)")
            self.loaded = False
            return

        try:
            import torch
            from PIL import Image
            # ---- Sesuaikan import dengan arsitektur model kamu ----
            # Kalau DeepSeek VL (Vision-Language):
            from transformers import AutoProcessor, AutoModelForVision2Seq

            print(f"[DeepSeekOCR] Loading model dari {model_path} ...")

            self.processor = AutoProcessor.from_pretrained(
                model_path,
                trust_remote_code=True   # diperlukan untuk model custom
            )
            self.model = AutoModelForVision2Seq.from_pretrained(
                model_path,
                trust_remote_code=True,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto"        # otomatis pakai GPU kalau ada
            )

            self.loaded = True
            device = "GPU ✓" if torch.cuda.is_available() else "CPU"
            print(f"[DeepSeekOCR] Model loaded → {device}")

        except Exception as e:
            print(f"[DeepSeekOCR] ❌ Gagal load model: {e}")
            self.loaded = False

    def extract_text(self, image_path: str) -> str:
        """
        Input  : path gambar (JPG/PNG)
        Output : raw text hasil OCR

        Kalau model belum diload → return dummy text untuk development
        """
        if not self.loaded:
            return self._dummy_text()

        try:
            import torch
            from PIL import Image
            image = Image.open(image_path).convert("RGB")

            # ---- Sesuaikan dengan cara inferensi model kamu ----
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=512,
                    do_sample=False
                )

            raw_text = self.processor.decode(outputs[0], skip_special_tokens=True)
            return raw_text

        except Exception as e:
            print(f"[DeepSeekOCR] ❌ Error saat OCR: {e}")
            return ""

    def _dummy_text(self) -> str:
        """Dummy output untuk development tanpa model"""
        return (
            "Tanggal: 15 Januari 2025\n"
            "Nama: Budi Santoso\n"
            "Kelas: X IPA 1\n"
            "Subjek: Matematika\n"
            "Pembayaran SPP Bulan: Januari 2025\n"
            "Jumlah: Rp 150.000"
        )

# Singleton — load sekali, pakai berkali-kali
deepseek_ocr = DeepSeekOCR()