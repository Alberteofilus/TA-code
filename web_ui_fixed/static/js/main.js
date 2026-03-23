// ===== TOGGLE PASSWORD =====
function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== STATE =====
let selectedFiles    = [];
let reviewData       = [];
let currentCardIndex = 0;
let allVerified      = false;
let currentView      = 'card'; // track view aktif: 'card' atau 'table'  

// ===== DRAG & DROP =====
document.addEventListener('DOMContentLoaded', () => {
  const dropZone      = document.getElementById('dropZone');
  const fileInput     = document.getElementById('fileInput');
  const fileInputMore = document.getElementById('fileInputMore'); // ← tambah file
  if (!dropZone) return;

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  // Input file utama (saat belum ada file)
  fileInput.addEventListener('change', () => {
    handleFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  // Input file tambahan (saat sudah ada file)
  if (fileInputMore) {
    fileInputMore.addEventListener('change', () => {
      handleFiles(Array.from(fileInputMore.files));
      fileInputMore.value = '';
    });
  }
});

function handleFiles(files) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  files.forEach(file => {
    if (!allowed.includes(file.type)) {
      showToast(`${file.name}: format tidak didukung`, 'error'); return;
    }
    if (file.size > 16 * 1024 * 1024) {
      showToast(`${file.name}: ukuran melebihi 16MB`, 'error'); return;
    }
    if (selectedFiles.length >= 10) {
      showToast('Maksimal 10 file sekaligus', 'error'); return;
    }
    if (selectedFiles.find(f => f.name === file.name && f.size === file.size)) return;
    selectedFiles.push(file);
  });
  renderThumbs();
}

function renderThumbs() {
  const grid       = document.getElementById('thumbGrid');
  const content    = document.getElementById('dropContent');
  const counter    = document.getElementById('fileCounter');
  const btn        = document.getElementById('processBtn');
  const startBtn   = document.getElementById('startOverBtn');
  const addMoreBtn = document.getElementById('addMoreBtn');

  if (!selectedFiles.length) {
    grid.style.display    = 'none';
    content.style.display = 'block';
    counter.style.display = 'none';
    if (startBtn)   startBtn.style.display   = 'none';
    if (addMoreBtn) addMoreBtn.style.display = 'none';
    btn.disabled = true;
    return;
  }

  content.style.display = 'none';
  grid.style.display    = 'grid';
  counter.style.display = 'inline-flex';
  if (startBtn) startBtn.style.display = 'inline-flex';

  // Tombol tambah file hanya muncul kalau belum 10 file
  if (addMoreBtn) {
    addMoreBtn.style.display = selectedFiles.length < 10 ? 'inline-flex' : 'none';
  }

  btn.disabled = false;
  document.getElementById('fileCountNum').textContent = selectedFiles.length;

  grid.innerHTML = selectedFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="thumb-item" id="thumb-${i}">
        <img src="${url}" alt="${f.name}"/>
        <button class="thumb-remove" onclick="removeFile(${i})">✕</button>
      </div>`;
  }).join('');
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderThumbs();
}

// ===== START OVER =====
function startOver() {
  selectedFiles = [];
  document.getElementById('fileInput').value = '';
  const fileInputMore = document.getElementById('fileInputMore');
  if (fileInputMore) fileInputMore.value = '';
  renderThumbs();
}

// ===== PROCESS OCR =====
async function processOCR() {
  if (!selectedFiles.length) return;

  setProcessing(true);
  reviewData = [];

  // [POIN 13] Upload satu per satu supaya bisa tampilkan progress per file
  const total   = selectedFiles.length;
  const errors  = [];

  for (let i = 0; i < total; i++) {
    const file     = selectedFiles[i];
    const progress = `(${i + 1}/${total}) Memproses: ${file.name}`;
    document.getElementById('progressText').textContent = progress;

    // Update thumbnail — highlight yang sedang diproses
    updateThumbState(i, 'processing');

    try {
      const formData = new FormData();
      formData.append('images', file);

      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        errors.push(`${file.name}: ${data.error || 'gagal'}`);
        updateThumbState(i, 'error');
        continue;
      }

      if (data.errors && data.errors.length) {
        errors.push(...data.errors);
        updateThumbState(i, 'error');
        continue;
      }

      reviewData.push(...data.results);
      updateThumbState(i, 'done');

    } catch {
      errors.push(`${file.name}: terjadi kesalahan`);
      updateThumbState(i, 'error');
    }
  }

  if (errors.length) {
    errors.forEach(e => showToast(e, 'error'));
  }

  if (reviewData.length) {
    showToast(`${reviewData.length} kuitansi berhasil diproses!`, 'success');
    showReviewSection();
  } else {
    showToast('Tidak ada file yang berhasil diproses.', 'error');
  }

  setProcessing(false);
}

// Update visual state thumbnail saat proses
function updateThumbState(index, state) {
  const thumb = document.getElementById(`thumb-${index}`);
  if (!thumb) return;

  // Hapus class state lama
  thumb.classList.remove('thumb-processing', 'thumb-done', 'thumb-error');

  if (state === 'processing') {
    thumb.classList.add('thumb-processing');
  } else if (state === 'done') {
    thumb.classList.add('thumb-done');
  } else if (state === 'error') {
    thumb.classList.add('thumb-error');
  }
}

function setProcessing(loading) {
  const btn = document.getElementById('processBtn');
  document.getElementById('processBtnText').style.display    = loading ? 'none' : 'flex';
  document.getElementById('processBtnLoading').style.display = loading ? 'flex' : 'none';
  btn.disabled = loading;
}

// ===== REVIEW SECTION =====
function showReviewSection() {
  allVerified = false;

  const vBtn = document.querySelector('.btn-verify-all');
  if (vBtn) vBtn.classList.remove('off');

  document.getElementById('reviewSection').style.display = 'block';
  document.getElementById('reviewCount').textContent     = reviewData.length;
  currentCardIndex = 0;

  document.getElementById('cardView').style.display  = 'block';
  document.getElementById('tableView').style.display = 'none';
  document.getElementById('btnCardView').classList.add('active');
  document.getElementById('btnTableView').classList.remove('active');

  renderCard(0);
  renderBulkTable();

  // Scroll tepat di tulisan "Hasil Ekstraksi" dengan offset navbar
  const reviewEl     = document.getElementById('reviewSection');
  const navbarHeight = 60;
  const top = reviewEl.getBoundingClientRect().top + window.scrollY - navbarHeight - 12;
  window.scrollTo({ top, behavior: 'smooth' });
}

// ===== SWITCH VIEW =====
function switchView(view) {
  currentView = view; // simpan view aktif
  if (view === 'card') {
    syncAllTableToData();
    document.getElementById('cardView').style.display  = 'block';
    document.getElementById('tableView').style.display = 'none';
    document.getElementById('btnCardView').classList.add('active');
    document.getElementById('btnTableView').classList.remove('active');
    renderCard(currentCardIndex);
  } else {
    syncCardToData(currentCardIndex);
    document.getElementById('tableView').style.display = 'block';
    document.getElementById('cardView').style.display  = 'none';
    document.getElementById('btnTableView').classList.add('active');
    document.getElementById('btnCardView').classList.remove('active');
    renderBulkTable();
  }
}

// ===== CARD VIEW =====
function renderCard(index) {
  const r = reviewData[index];
  if (!r) return;

  document.getElementById('cardRecordId').value        = r.id;
  document.getElementById('card_tanggal').value        = r.tanggal_pembayaran || '';
  document.getElementById('card_nama').value           = r.nama || '';
  document.getElementById('card_kelas').value          = r.kelas || '';
  document.getElementById('card_subjek').value         = r.subjek || '';
  document.getElementById('card_bulan_spp').value      = r.bulan_spp || '';
  document.getElementById('card_nominal_spp').value    = r.nominal_spp || '';
  document.getElementById('card_verified').checked    = r.is_verified || false;
  document.getElementById('card_raw_ocr').textContent  = r.raw_ocr_text || '';
  document.getElementById('cardImg').src               = `/static/uploads/${r.image_path}`;
  document.getElementById('cardPos').textContent       = `${index + 1} / ${reviewData.length}`;
  document.getElementById('btnPrev').disabled          = index === 0;
  document.getElementById('btnNext').disabled          = index === reviewData.length - 1;
  updateCardBadge();
}

function navigateCard(dir) {
  syncCardToData(currentCardIndex);
  currentCardIndex = Math.max(0, Math.min(reviewData.length - 1, currentCardIndex + dir));
  renderCard(currentCardIndex);
}

function syncCardToData(index) {
  if (!reviewData[index]) return;
  reviewData[index] = {
    ...reviewData[index],
    tanggal_pembayaran: document.getElementById('card_tanggal').value,
    nama:               document.getElementById('card_nama').value,
    kelas:              document.getElementById('card_kelas').value,
    subjek:             document.getElementById('card_subjek').value,
    bulan_spp:          document.getElementById('card_bulan_spp').value,
    nominal_spp:        parseFloat(document.getElementById('card_nominal_spp').value) || null,
    is_verified:        document.getElementById('card_verified').checked,
  };
}

// Sync semua baris tabel ke reviewData
function syncAllTableToData() {
  const tbody = document.getElementById('bulkTableBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, i) => {
    if (!reviewData[i]) return;
    const inputs   = row.querySelectorAll('input.bulk-input');
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (inputs[0]) reviewData[i].tanggal_pembayaran = inputs[0].value;
    if (inputs[1]) reviewData[i].nama               = inputs[1].value;
    if (inputs[2]) reviewData[i].kelas              = inputs[2].value;
    if (inputs[3]) reviewData[i].subjek             = inputs[3].value;
    if (inputs[4]) reviewData[i].bulan_spp          = inputs[4].value;
    if (inputs[5]) reviewData[i].nominal_spp        = parseFloat(inputs[5].value) || null;
    if (checkbox)  reviewData[i].is_verified        = checkbox.checked;
  });
}

// Simpan semua (dari card maupun tabel) lalu reset
async function saveCard() {
  syncCardToData(currentCardIndex);
  showConfirmModal(
    'Simpan Semua Data?',
    `Apakah kamu yakin ingin menyimpan semua ${reviewData.length} data?`,
    async () => {
      let success = 0;
      for (const r of reviewData) {
        const ok = await saveRecordToDb(r);
        if (ok) success++;
      }
      showToast(`${success} dari ${reviewData.length} data berhasil disimpan!`, 'success');
      resetToStart();
    }
  );
}

function updateCardBadge() {
  const v = document.getElementById('card_verified').checked;
  const b = document.getElementById('cardStatusBadge');
  if (!b) return;
  b.className   = v ? 'badge badge-verified' : 'badge badge-pending';
  b.textContent = v ? 'Verified' : 'Pending';
}

// ===== TABLE VIEW =====
function renderBulkTable() {
  const tbody = document.getElementById('bulkTableBody');
  if (!tbody) return;

  tbody.innerHTML = reviewData.map((r, i) => `
    <tr>
      <td>
        <img class="bulk-thumb" src="/static/uploads/${r.image_path}" alt=""
          onerror="this.style.display='none'"/>
      </td>
      <td><input class="bulk-input" value="${escHtml(r.tanggal_pembayaran)}" onchange="syncTableToData(${i},'tanggal_pembayaran',this.value)"/></td>
      <td><input class="bulk-input" value="${escHtml(r.nama)}" onchange="syncTableToData(${i},'nama',this.value)"/></td>
      <td><input class="bulk-input" value="${escHtml(r.kelas)}" onchange="syncTableToData(${i},'kelas',this.value)"/></td>
      <td><input class="bulk-input" value="${escHtml(r.subjek)}" onchange="syncTableToData(${i},'subjek',this.value)"/></td>
      <td><input class="bulk-input" value="${escHtml(r.bulan_spp)}" onchange="syncTableToData(${i},'bulan_spp',this.value)"/></td>
      <td><input class="bulk-input" type="number" value="${r.nominal_spp || ''}" onchange="syncTableToData(${i},'nominal_spp',parseFloat(this.value)||null)"/></td>
      <td style="text-align:center">
        <input type="checkbox" ${r.is_verified ? 'checked' : ''}
          onchange="syncTableToData(${i},'is_verified',this.checked)"
          style="width:16px;height:16px;accent-color:var(--primary-dark);cursor:pointer"/>
      </td>
      <td>
        <button class="tbl-btn tbl-btn-delete" onclick="deleteFromReview(${i})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
          Hapus
        </button>
      </td>
    </tr>
  `).join('');
}

function syncTableToData(index, field, value) {
  if (reviewData[index]) reviewData[index][field] = value;
}

async function saveAllTable() {
  syncAllTableToData();
  showConfirmModal(
    'Simpan Semua Data?',
    `Apakah kamu yakin ingin menyimpan ${reviewData.length} data sekaligus?`,
    async () => {
      let success = 0;
      for (const r of reviewData) {
        const ok = await saveRecordToDb(r);
        if (ok) success++;
      }
      showToast(`${success} dari ${reviewData.length} data berhasil disimpan!`, 'success');
      resetToStart();
    }
  );
}

// ===== RESET KE AWAL =====
async function resetToStart() {
  selectedFiles    = [];
  reviewData       = [];
  currentCardIndex = 0;
  allVerified      = false;

  document.getElementById('fileInput').value = '';
  const fileInputMore = document.getElementById('fileInputMore');
  if (fileInputMore) fileInputMore.value = '';

  renderThumbs();

  document.getElementById('reviewSection').style.display = 'none';

  const vBtn = document.querySelector('.btn-verify-all');
  if (vBtn) vBtn.classList.remove('off');

  // Refresh Data Terbaru dari server
  await refreshRecentTable();

  // Scroll ke bagian Data Terbaru
  const recentEl = document.getElementById('recentSection');
  if (recentEl) {
    const top = recentEl.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ===== REFRESH DATA TERBARU =====
async function refreshRecentTable() {
  try {
    const res  = await fetch('/api/recent');
    const data = await res.json();

    // Update stat cards
    const elTotal    = document.querySelector('.stat-icon-blue ~ .stat-info .stat-value');
    const elVerified = document.querySelector('.stat-icon-green ~ .stat-info .stat-value');
    const elPending  = document.querySelector('.stat-icon-orange ~ .stat-info .stat-value');
    if (elTotal)    elTotal.textContent    = data.total;
    if (elVerified) elVerified.textContent = data.verified;
    if (elPending)  elPending.textContent  = data.pending;

    // Update tabel Data Terbaru
    const tbody = document.getElementById('recentTableBody');
    if (!tbody) return;

    if (!data.records.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Belum ada data.</td></tr>';
      return;
    }

    tbody.innerHTML = data.records.map(r => `
      <tr>
        <td>${r.tanggal_pembayaran || '—'}</td>
        <td>${escHtml(r.nama) || '—'}</td>
        <td>${escHtml(r.kelas) || '—'}</td>
        <td>${escHtml(r.bulan_spp) || '—'}</td>
        <td>${r.nominal_spp ? 'Rp ' + Number(r.nominal_spp).toLocaleString('id-ID') : '—'}</td>
        <td>
          <span class="badge ${r.is_verified ? 'badge-verified' : 'badge-pending'}">
            ${r.is_verified ? 'Verified' : 'Pending'}
          </span>
        </td>
      </tr>
    `).join('');

  } catch (e) {
    console.error('Gagal refresh recent table:', e);
  }
}

// ===== SAVE SINGLE RECORD TO DB =====
async function saveRecordToDb(r) {
  try {
    const res = await fetch(`/api/record/${r.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tanggal_pembayaran: r.tanggal_pembayaran,
        nama:               r.nama,
        kelas:              r.kelas,
        subjek:             r.subjek,
        bulan_spp:          r.bulan_spp,
        nominal_spp:        r.nominal_spp,
        is_verified:        r.is_verified,
      })
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ===== HAPUS DARI REVIEW =====
function deleteFromReview(index) {
  showConfirmModal(
    'Hapus Data?',
    'Data ini akan dihapus. Lanjutkan?',
    async () => {
      const r = reviewData[index];
      try {
        await fetch(`/api/record/${r.id}`, { method: 'DELETE' });
      } catch { /* abaikan */ }

      reviewData.splice(index, 1);

      if (!reviewData.length) {
        document.getElementById('reviewSection').style.display = 'none';
        showToast('Semua data dihapus.', 'success');
        return;
      }

      if (currentCardIndex >= reviewData.length) {
        currentCardIndex = reviewData.length - 1;
      }

      document.getElementById('reviewCount').textContent = reviewData.length;
      renderCard(currentCardIndex);
      renderBulkTable();
      showToast('Data dihapus.', 'success');
    }
  );
}

function deleteCurrentCard() {
  deleteFromReview(currentCardIndex);
}

// ===== VERIFY ALL TOGGLE =====
async function verifyAll() {
  if (!reviewData.length) return;

  // Sync data sesuai view yang sedang aktif agar tidak menimpa data yang sudah diedit
  if (currentView === 'table') {
    syncAllTableToData();
  } else {
    syncCardToData(currentCardIndex);
  }

  const newStatus = !allVerified;
  reviewData.forEach(r => r.is_verified = newStatus);

  const ids = reviewData.map(r => r.id);

  try {
    const res  = await fetch('/api/records/verify-all', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids, verified: newStatus })
    });
    const data = await res.json();

    if (data.success) {
      allVerified = newStatus;
      const btn = document.querySelector('.btn-verify-all');
      if (newStatus) {
        btn.classList.remove('off');
        showToast(`${data.updated} data berhasil diverifikasi!`, 'success');
      } else {
        btn.classList.add('off');
        showToast(`${data.updated} data berhasil di-unverifikasi!`, 'success');
      }
      renderCard(currentCardIndex);
      renderBulkTable();
    } else {
      showToast('Gagal mengubah status.', 'error');
    }
  } catch {
    showToast('Terjadi kesalahan.', 'error');
  }
}

// ===== CONFIRM MODAL =====
let confirmCallback = null;

function showConfirmModal(title, message, onConfirm) {
  confirmCallback = onConfirm;
  document.getElementById('confirmTitle').textContent   = title;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
  confirmCallback = null;
  document.getElementById('confirmModal').style.display = 'none';
}

async function confirmAction() {
  document.getElementById('confirmModal').style.display = 'none';
  if (confirmCallback) await confirmCallback();
  confirmCallback = null;
}

function closeConfirmOutside(e) {
  if (e.target.id === 'confirmModal') closeConfirmModal();
}

// ===== HELPERS =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `flash flash-${type} toast`;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;min-width:280px;';
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">✕</button>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
