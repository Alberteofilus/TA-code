from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from database.models import db, User

auth_bp = Blueprint('auth', __name__)
bcrypt  = Bcrypt()

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        email    = request.form.get('email', '').strip()
        password = request.form.get('password', '')

        user = User.query.filter_by(email=email).first()

        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user, remember=True)
            next_page = request.args.get('next')
            return redirect(next_page or url_for('main.dashboard'))
        else:
            flash('Email atau password salah.', 'error')

    return render_template('login.html')


@auth_bp.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email    = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm  = request.form.get('confirm_password', '')

        # Validasi
        if not username or not email or not password:
            flash('Semua field wajib diisi.', 'error')
            return render_template('signup.html')

        if password != confirm:
            flash('Password tidak cocok.', 'error')
            return render_template('signup.html')

        if len(password) < 6:
            flash('Password minimal 6 karakter.', 'error')
            return render_template('signup.html')

        if User.query.filter_by(email=email).first():
            flash('Email sudah terdaftar.', 'error')
            return render_template('signup.html')

        if User.query.filter_by(username=username).first():
            flash('Username sudah dipakai.', 'error')
            return render_template('signup.html')

        hashed = bcrypt.generate_password_hash(password).decode('utf-8')
        user   = User(username=username, email=email, password=hashed)
        db.session.add(user)
        db.session.commit()

        flash('Akun berhasil dibuat! Silakan login.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('signup.html')


@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))
