import os
import uuid
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from database.models import db, OCRRecord
from models.deepseek_ocr import deepseek_ocr
from models.indobert_ner import indobert_extractor

ocr_bp = Blueprint('ocr', __name__)


def allowed_file(filename):
    allowed = current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg', 'webp'})
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed


def save_image(file):
    ext      = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    folder   = current_app.config['UPLOAD_FOLDER']
    os.makedirs(folder, exist_ok=True)
    path     = os.path.join(folder, filename)
    file.save(path)
    return path, filename


def delete_image_file(image_path):
    """Hapus file gambar dari disk."""
    if image_path:
        full_path = os.path.join('static', 'uploads', image_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception as e:
                print(f"[OCR] ⚠️  Gagal hapus file {full_path}: {e}")


# ─── BULK UPLOAD ─────────────────────────────────────────────────────────────
@ocr_bp.route('/upload', methods=['POST'])
@login_required
def upload():
    files = request.files.getlist('images')

    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'Tidak ada file yang diupload.'}), 400

    results = []
    errors  = []

    for file in files:
        if not allowed_file(file.filename):
            errors.append(f'{file.filename}: format tidak didukung')
            continue
        try:
            image_path, filename = save_image(file)
            raw_text  = deepseek_ocr.extract_text(image_path)
            extracted = indobert_extractor.extract_fields(raw_text)

            record = OCRRecord(
                user_id            = current_user.id,
                image_path         = filename,
                raw_ocr_text       = raw_text,
                tanggal_pembayaran = extracted.get('tanggal_pembayaran'),  # date object
                nama               = extracted.get('nama'),
                kelas              = extracted.get('kelas'),
                subjek             = extracted.get('subjek'),
                bulan_spp          = extracted.get('bulan_spp'),
                nominal_spp        = extracted.get('nominal_spp'),
                is_verified        = False,
                is_deleted         = False,
            )
            db.session.add(record)
            db.session.flush()
            results.append(record.to_dict())

        except Exception as e:
            errors.append(f'{file.filename}: {str(e)}')

    db.session.commit()

    return jsonify({
        'success': True,
        'results': results,
        'errors':  errors,
        'total':   len(results),
    })


# ─── GET SINGLE RECORD ───────────────────────────────────────────────────────
@ocr_bp.route('/record/<int:record_id>', methods=['GET'])
@login_required
def get_record(record_id):
    record = OCRRecord.query.filter_by(
        id=record_id, user_id=current_user.id, is_deleted=False
    ).first()
    if not record:
        return jsonify({'error': 'Data tidak ditemukan.'}), 404
    return jsonify({'success': True, 'data': record.to_dict()})


# ─── UPDATE RECORD ───────────────────────────────────────────────────────────
@ocr_bp.route('/record/<int:record_id>', methods=['PUT'])
@login_required
def update_record(record_id):
    record = OCRRecord.query.filter_by(
        id=record_id, user_id=current_user.id, is_deleted=False
    ).first()
    if not record:
        return jsonify({'error': 'Data tidak ditemukan.'}), 404

    data = request.get_json()

    # tanggal_pembayaran dikirim dari UI sebagai "DD-MM-YYYY"
    # perlu dikonversi ke date object sebelum simpan
    tgl_str = data.get('tanggal_pembayaran', '')
    if tgl_str:
        try:
            from datetime import date as date_type
            parts = tgl_str.split('-')
            if len(parts) == 3:
                record.tanggal_pembayaran = date_type(
                    int(parts[2]), int(parts[1]), int(parts[0])
                )
        except (ValueError, IndexError):
            pass  # biarkan nilai lama kalau format salah
    else:
        record.tanggal_pembayaran = None

    record.nama        = data.get('nama',        record.nama)
    record.kelas       = data.get('kelas',       record.kelas)
    record.subjek      = data.get('subjek',      record.subjek)
    record.bulan_spp   = data.get('bulan_spp',   record.bulan_spp)
    record.nominal_spp = data.get('nominal_spp', record.nominal_spp)
    record.is_verified = data.get('is_verified', record.is_verified)

    db.session.commit()
    return jsonify({'success': True, 'data': record.to_dict()})


# ─── SOFT DELETE (hapus file gambar sekaligus) ───────────────────────────────
@ocr_bp.route('/record/<int:record_id>', methods=['DELETE'])
@login_required
def delete_record(record_id):
    record = OCRRecord.query.filter_by(
        id=record_id, user_id=current_user.id, is_deleted=False
    ).first()
    if not record:
        return jsonify({'error': 'Data tidak ditemukan.'}), 404

    # Hapus file gambar dari disk bersamaan dengan soft delete
    delete_image_file(record.image_path)

    record.is_deleted = True
    record.deleted_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True})


# ─── VERIFY ALL ──────────────────────────────────────────────────────────────
@ocr_bp.route('/records/verify-all', methods=['PUT'])
@login_required
def verify_all():
    data       = request.get_json()
    ids        = data.get('ids', [])
    set_status = data.get('verified', True)

    if not ids:
        return jsonify({'error': 'Tidak ada ID yang dikirim.'}), 400

    OCRRecord.query.filter(
        OCRRecord.id.in_(ids),
        OCRRecord.user_id == current_user.id,
        OCRRecord.is_deleted == False
    ).update({'is_verified': set_status}, synchronize_session='fetch')

    db.session.commit()
    return jsonify({'success': True, 'updated': len(ids), 'verified': set_status})


# ─── GET SUBJECTS ─────────────────────────────────────────────────────────────
@ocr_bp.route('/subjects', methods=['GET'])
@login_required
def get_subjects():
    subjects = ['MATH', 'EFL', 'BIND']
    return jsonify({'subjects': subjects})


# ─── LIST RECORDS ─────────────────────────────────────────────────────────────
@ocr_bp.route('/records', methods=['GET'])
@login_required
def get_records():
    page      = request.args.get('page', 1, type=int)
    per_page  = request.args.get('per_page', 10, type=int)
    search    = request.args.get('search', '')
    status    = request.args.get('status', '')
    subjek    = request.args.get('subjek', '')
    date_from = request.args.get('date_from', '')   # format: YYYY-MM-DD dari date picker
    date_to   = request.args.get('date_to', '')

    query = OCRRecord.query.filter_by(user_id=current_user.id, is_deleted=False)

    if search:
        query = query.filter(
            db.or_(
                OCRRecord.nama.ilike(f'%{search}%'),
                OCRRecord.kelas.ilike(f'%{search}%'),
                OCRRecord.bulan_spp.ilike(f'%{search}%'),
                OCRRecord.subjek.ilike(f'%{search}%'),
            )
        )

    if status == 'verified':
        query = query.filter(OCRRecord.is_verified == True)
    elif status == 'pending':
        query = query.filter(OCRRecord.is_verified == False)

    if subjek:
        query = query.filter(OCRRecord.subjek.ilike(f'%{subjek}%'))

    # Filter tanggal_pembayaran (tipe Date) — compare akurat
    if date_from:
        try:
            df = datetime.strptime(date_from, '%Y-%m-%d').date()
            query = query.filter(OCRRecord.tanggal_pembayaran >= df)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.strptime(date_to, '%Y-%m-%d').date()
            query = query.filter(OCRRecord.tanggal_pembayaran <= dt)
        except ValueError:
            pass

    pagination = query.order_by(OCRRecord.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'records': [r.to_dict() for r in pagination.items],
        'total':   pagination.total,
        'pages':   pagination.pages,
        'current': page,
    })


# ─── EXPORT EXCEL (ikut filter aktif + timezone GMT+7) ───────────────────────
@ocr_bp.route('/export', methods=['GET'])
@login_required
def export_excel():
    import pandas as pd
    import io

    search    = request.args.get('search', '')
    status    = request.args.get('status', '')
    subjek    = request.args.get('subjek', '')
    date_from = request.args.get('date_from', '')
    date_to   = request.args.get('date_to', '')

    query = OCRRecord.query.filter_by(user_id=current_user.id, is_deleted=False)

    if search:
        query = query.filter(
            db.or_(
                OCRRecord.nama.ilike(f'%{search}%'),
                OCRRecord.kelas.ilike(f'%{search}%'),
                OCRRecord.bulan_spp.ilike(f'%{search}%'),
                OCRRecord.subjek.ilike(f'%{search}%'),
            )
        )

    if status == 'verified':
        query = query.filter(OCRRecord.is_verified == True)
    elif status == 'pending':
        query = query.filter(OCRRecord.is_verified == False)

    if subjek:
        query = query.filter(OCRRecord.subjek.ilike(f'%{subjek}%'))

    if date_from:
        try:
            df = datetime.strptime(date_from, '%Y-%m-%d').date()
            query = query.filter(OCRRecord.tanggal_pembayaran >= df)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.strptime(date_to, '%Y-%m-%d').date()
            query = query.filter(OCRRecord.tanggal_pembayaran <= dt)
        except ValueError:
            pass

    records = query.order_by(OCRRecord.created_at.desc()).all()

    data = [{
        'Tanggal Pembayaran': r.tanggal_pembayaran.strftime('%d-%m-%Y')
                              if r.tanggal_pembayaran else '',
        'Nama':               r.nama or '',
        'Kelas':              r.kelas or '',
        'Subjek':             r.subjek or '',
        'Bulan SPP':          r.bulan_spp or '',
        'Nominal SPP':        float(r.nominal_spp) if r.nominal_spp else 0,
        'Status':             'Verified' if r.is_verified else 'Pending',
        # created_at + 7 jam untuk timezone GMT+7
        'Dibuat':             (r.created_at + timedelta(hours=7)).strftime('%d/%m/%Y %H:%M')
                              if r.created_at else '',
    } for r in records]

    df     = pd.DataFrame(data)
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Data SPP')
        ws = writer.sheets['Data SPP']
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col) + 4
            ws.column_dimensions[col[0].column_letter].width = min(max_len, 40)

    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name='data_spp.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
