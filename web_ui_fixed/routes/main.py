from flask import Blueprint, render_template, jsonify
from flask_login import login_required, current_user
from database.models import OCRRecord, db

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
@login_required
def dashboard():
    total    = OCRRecord.query.filter_by(user_id=current_user.id, is_deleted=False).count()
    verified = OCRRecord.query.filter_by(user_id=current_user.id, is_verified=True, is_deleted=False).count()
    pending  = total - verified
    recent   = OCRRecord.query.filter_by(user_id=current_user.id, is_deleted=False)\
                   .order_by(OCRRecord.created_at.desc()).limit(5).all()

    return render_template('dashboard.html',
        total=total, verified=verified, pending=pending, recent=recent
    )


@main_bp.route('/records')
@login_required
def records():
    return render_template('records.html')



@main_bp.route('/api/recent')
@login_required
def recent_records():
    recent   = OCRRecord.query.filter_by(user_id=current_user.id, is_deleted=False)\
                   .order_by(OCRRecord.created_at.desc()).limit(5).all()
    total    = OCRRecord.query.filter_by(user_id=current_user.id, is_deleted=False).count()
    verified = OCRRecord.query.filter_by(user_id=current_user.id, is_verified=True, is_deleted=False).count()

    return jsonify({
        'records':  [r.to_dict() for r in recent],
        'total':    total,
        'verified': verified,
        'pending':  total - verified,
    })
