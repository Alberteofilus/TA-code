from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(80), unique=True, nullable=False)
    email      = db.Column(db.String(120), unique=True, nullable=False)
    password   = db.Column(db.String(255), nullable=False)
    role       = db.Column(db.Enum('admin', 'user'), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    records = db.relationship('OCRRecord', backref='owner', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username}>'


class OCRRecord(db.Model):
    __tablename__ = 'ocr_records'

    id                 = db.Column(db.Integer, primary_key=True)
    user_id            = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    image_path         = db.Column(db.String(255))
    raw_ocr_text       = db.Column(db.Text)
    tanggal_pembayaran = db.Column(db.Date, nullable=True)      # ← Date, bukan String
    nama               = db.Column(db.String(100))
    kelas              = db.Column(db.String(50))
    subjek             = db.Column(db.String(100))
    bulan_spp          = db.Column(db.String(50))
    nominal_spp        = db.Column(db.Numeric(12, 2))
    is_verified        = db.Column(db.Boolean, default=False)
    is_deleted         = db.Column(db.Boolean, default=False)
    deleted_at         = db.Column(db.DateTime, nullable=True)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                 self.id,
            'image_path':         self.image_path,
            'raw_ocr_text':       self.raw_ocr_text,
            # DB: 2025-06-10 → UI: "10-06-2025"
            'tanggal_pembayaran': self.tanggal_pembayaran.strftime('%d-%m-%Y')
                                  if self.tanggal_pembayaran else '',
            'nama':               self.nama or '',
            'kelas':              self.kelas or '',
            'subjek':             self.subjek or '',
            'bulan_spp':          self.bulan_spp or '',
            'nominal_spp':        float(self.nominal_spp) if self.nominal_spp else 0,
            'is_verified':        self.is_verified,
            'is_deleted':         self.is_deleted,
            'created_at':         self.created_at.strftime('%d %b %Y %H:%M')
                                  if self.created_at else '',
        }
