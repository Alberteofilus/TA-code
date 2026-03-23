import os
from flask import Flask
from flask_login import LoginManager
from config import Config
from database.models import db, User
from routes.auth import auth_bp, bcrypt
from routes.ocr import ocr_bp
from routes.main import main_bp
from models.deepseek_ocr import deepseek_ocr
from models.indobert_ner import indobert_extractor

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Init extensions
    db.init_app(app)
    bcrypt.init_app(app)

    # Flask-Login setup
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view     = 'auth.login'
    login_manager.login_message  = 'Silakan login terlebih dahulu.'
    login_manager.login_message_category = 'error'

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(ocr_bp,  url_prefix='/api')
    app.register_blueprint(main_bp)

    # Buat tabel database kalau belum ada
    with app.app_context():
        db.create_all()
        print("[DB] Tabel siap ✓")

    # Load AI models sekali saat start
    with app.app_context():
        deepseek_ocr.load_model(app.config['DEEPSEEK_MODEL_PATH'])
        indobert_extractor.load_model(app.config['INDOBERT_MODEL_PATH'])

    # Pastikan folder upload ada
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
