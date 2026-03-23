import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY     = os.environ.get('SECRET_KEY', 'dev-secret-key')
    MYSQL_HOST     = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_PORT     = int(os.environ.get('MYSQL_PORT', 3306))
    MYSQL_USER     = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')
    MYSQL_DB       = os.environ.get('MYSQL_DB', 'ocr_spp')


    SQLALCHEMY_DATABASE_URI = 'sqlite:///test.db'
    # SQLALCHEMY_DATABASE_URI = (
    #     f"mysql+pymysql://{os.environ.get('MYSQL_USER','root')}:"
    #     f"{os.environ.get('MYSQL_PASSWORD','')}@"
    #     f"{os.environ.get('MYSQL_HOST','localhost')}:"
    #     f"{os.environ.get('MYSQL_PORT',3306)}/"
    #     f"{os.environ.get('MYSQL_DB','ocr_spp')}"
    # )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER      = os.path.join('static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

    DEEPSEEK_MODEL_PATH = os.environ.get('DEEPSEEK_MODEL_PATH', './ai_models/deepseek_ocr')
    INDOBERT_MODEL_PATH = os.environ.get('INDOBERT_MODEL_PATH', './ai_models/indobert')
