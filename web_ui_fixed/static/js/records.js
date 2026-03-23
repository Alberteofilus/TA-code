let currentPage     = 1;
let currentSearch   = '';
let currentStatus   = '';
let currentSubjek   = '';
let currentDateFrom = '';
let currentDateTo   = '';
let deleteTargetId  = null;
let deleteTargetIds = [];
let searchTimer     = null;
let selectedIds     = new Set();
let selectModeActive = false;
let allSubjects     = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  loadSubjects();
  document.addEventListener('click', e => {
    if (!document.getElementById('subjekComboWrapper')?.contains(e.target)) {
      closeSubjekDropdown();
    }
  });
});

// ===== LOAD SUBJECTS =====
async function loadSubjects() {
  try {
    const res  = await fetch('/api/subjects');
    const data = await res.json();
    allSubjects = data.subjects || [];
    renderSubjekDropdown(allSubjects);
  } catch { /* silent */ }
}

// ===== SUBJEK COMBO =====
function onSubjekInput() {
  const val      = document.getElementById('filterSubjek').value.toLowerCase();
  const filtered = val ? allSubjects.filter(s => s.toLowerCase().includes(val)) : allSubjects;
  renderSubjekDropdown(filtered);
  openSubjekDropdown();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSubjek = document.getElementById('filterSubjek').value;
    loadRecords(1);
    updateFilterUI();
  }, 400);
}

function renderSubjekDropdown(subjects) {
  const dropdown = document.getElementById('subjekDropdown');
  if (!subjects.length) {
    dropdown.innerHTML = `<div class="filter-combo-option" style="color:var(--text-muted)">Tidak ada opsi</div>`;
    return;
  }
  dropdown.innerHTML = subjects.map(s => `
    <div class="filter-combo-option ${currentSubjek === s ? 'active' : ''}"
      onclick="selectSubjek('${s.replace(/'/g, "\\'")}')">
      ${s}
    </div>
  `).join('');
}

function openSubjekDropdown()  { document.getElementById('subjekDropdown').classList.add('open'); }
function closeSubjekDropdown() { document.getElementById('subjekDropdown').classList.remove('open'); }

function selectSubjek(val) {
  document.getElementById('filterSubjek').value = val;
  currentSubjek = val;
  closeSubjekDropdown();
  loadRecords(1);
  updateFilterUI();
}

// ===== LOAD RECORDS =====
async function loadRecords(page = 1) {
  currentPage = page;
  const cols  = selectModeActive ? 11 : 10;
  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = `<tr><td colspan="${cols}" class="table-loading">
    <span class="spinner" style="border-color:rgba(0,0,0,0.15);border-top-color:#63c4ff;"></span>
    Memuat...
  </td></tr>`;

  try {
    const params = new URLSearchParams({
      page,
      per_page:  10,
      search:    currentSearch,
      status:    currentStatus,
      subjek:    currentSubjek,
      date_from: currentDateFrom,
      date_to:   currentDateTo,
    });

    const res  = await fetch(`/api/records?${params}`);
    const data = await res.json();

    renderTable(data.records);
    renderPagination(data.pages, data.current, data.total);
    document.getElementById('tableCount').textContent = `${data.total} data ditemukan`;

    const selectAllEl = document.getElementById('selectAll');
    if (selectAllEl) selectAllEl.checked = false;
    selectedIds.clear();
    updateBulkBar();

  } catch {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="table-loading" style="color:#ef4444">Gagal memuat data.</td></tr>`;
  }
}

// ===== RENDER TABLE =====
function renderTable(records) {
  const tbody = document.getElementById('recordsBody');
  const cols  = selectModeActive ? 11 : 10;

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="table-loading">Tidak ada data yang sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((r, i) => `
    <tr id="row-${r.id}" class="${selectedIds.has(r.id) ? 'row-selected' : ''}">
      <td id="td-check-${r.id}" style="display:${selectModeActive ? 'table-cell' : 'none'}">
        <input type="checkbox" class="row-check" data-id="${r.id}"
          ${selectedIds.has(r.id) ? 'checked' : ''}
          onchange="toggleRow(${r.id}, this.checked)"
          style="width:15px;height:15px;accent-color:var(--primary-dark);cursor:pointer"/>
      </td>
      <td style="color:var(--text-muted);font-size:12px">${(currentPage - 1) * 10 + i + 1}</td>
      <td>${r.tanggal_pembayaran || '—'}</td>
      <td style="font-weight:500">${r.nama || '—'}</td>
      <td>${r.kelas || '—'}</td>
      <td>${r.subjek || '—'}</td>
      <td>${r.bulan_spp || '—'}</td>
      <td style="font-weight:600">${r.nominal_spp ? 'Rp ' + formatRupiah(r.nominal_spp) : '—'}</td>
      <td>
        <span class="badge ${r.is_verified ? 'badge-verified' : 'badge-pending'}">
          ${r.is_verified ? 'Verified' : 'Pending'}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="tbl-btn tbl-btn-edit" onclick="openEdit(${r.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button class="tbl-btn tbl-btn-delete" onclick="openDelete(${r.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
            Hapus
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ===== PAGINATION =====
function renderPagination(totalPages, current, total) {
  const container = document.getElementById('pagination');
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="loadRecords(${current - 1})" ${current === 1 ? 'disabled' : ''}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
  </button>`;

  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= current - 1 && p <= current + 1)) {
      html += `<button class="page-btn ${p === current ? 'active' : ''}" onclick="loadRecords(${p})">${p}</button>`;
    } else if (p === current - 2 || p === current + 2) {
      html += `<span style="color:var(--text-muted);font-size:12px;padding:0 4px">···</span>`;
    }
  }

  html += `<button class="page-btn" onclick="loadRecords(${current + 1})" ${current === totalPages ? 'disabled' : ''}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
  </button>`;

  container.innerHTML = html;
}

// ===== SEARCH =====
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = document.getElementById('searchInput').value;
    loadRecords(1);
    updateFilterUI();
  }, 400);
}

// ===== FILTER =====
function applyFilters() {
  currentStatus   = document.getElementById('filterStatus').value;
  currentDateFrom = document.getElementById('filterDateFrom').value;
  currentDateTo   = document.getElementById('filterDateTo').value;
  loadRecords(1);
  updateFilterUI();
}

function resetFilters() {
  document.getElementById('filterStatus').value   = '';
  document.getElementById('filterSubjek').value   = '';
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value   = '';
  document.getElementById('searchInput').value    = '';
  currentStatus = ''; currentSubjek = '';
  currentDateFrom = ''; currentDateTo = ''; currentSearch = '';
  loadRecords(1);
  updateFilterUI();
}

function updateFilterUI() {
  const hasFilter = currentStatus || currentSubjek || currentDateFrom || currentDateTo || currentSearch;
  document.getElementById('resetFilterBtn').style.display = hasFilter ? 'inline-flex' : 'none';
  document.getElementById('filterTags').style.display     = hasFilter ? 'flex'        : 'none';

  const tags = [];
  if (currentSearch)                tags.push({ label: `Cari: "${currentSearch}"`,                                    key: 'search'    });
  if (currentStatus === 'verified') tags.push({ label: 'Status: Verified',                                            key: 'status'    });
  if (currentStatus === 'pending')  tags.push({ label: 'Status: Pending',                                             key: 'status'    });
  if (currentSubjek)                tags.push({ label: `Subjek: ${currentSubjek}`,                                    key: 'subjek'    });
  if (currentDateFrom)              tags.push({ label: `Tgl Bayar dari: ${formatDateDisplay(currentDateFrom)}`,       key: 'date_from' });
  if (currentDateTo)                tags.push({ label: `Tgl Bayar s/d: ${formatDateDisplay(currentDateTo)}`,         key: 'date_to'   });

  document.getElementById('filterTagList').innerHTML = tags.map(t => `
    <span class="filter-tag">
      ${t.label}
      <button onclick="removeFilter('${t.key}')">✕</button>
    </span>
  `).join('');
}

function removeFilter(key) {
  if (key === 'search')    { currentSearch   = ''; document.getElementById('searchInput').value    = ''; }
  if (key === 'status')    { currentStatus   = ''; document.getElementById('filterStatus').value   = ''; }
  if (key === 'subjek')    { currentSubjek   = ''; document.getElementById('filterSubjek').value   = ''; }
  if (key === 'date_from') { currentDateFrom = ''; document.getElementById('filterDateFrom').value = ''; }
  if (key === 'date_to')   { currentDateTo   = ''; document.getElementById('filterDateTo').value   = ''; }
  loadRecords(1);
  updateFilterUI();
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

// ===== EXPORT IKUT FILTER =====
function exportWithFilter(e) {
  e.preventDefault();
  const params = new URLSearchParams({
    search:    currentSearch,
    status:    currentStatus,
    subjek:    currentSubjek,
    date_from: currentDateFrom,
    date_to:   currentDateTo,
  });
  window.location.href = `/api/export?${params}`;
}

// ===== SELECT MODE TOGGLE =====
function toggleSelectMode() {
  selectModeActive = !selectModeActive;

  const thCheckbox = document.getElementById('thCheckbox');
  const btnPilih   = document.getElementById('btnPilih');

  if (selectModeActive) {
    thCheckbox.style.display = 'table-cell';
    btnPilih.classList.add('active');
    btnPilih.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg> Selesai`;
    document.querySelectorAll('[id^="td-check-"]').forEach(td => td.style.display = 'table-cell');
  } else {
    exitSelectMode();
  }
}

function exitSelectMode() {
  selectModeActive = false;
  selectedIds.clear();

  document.getElementById('thCheckbox').style.display = 'none';
  document.getElementById('selectAll').checked        = false;

  const btnPilih = document.getElementById('btnPilih');
  btnPilih.classList.remove('active');
  btnPilih.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg> Pilih`;

  document.querySelectorAll('[id^="td-check-"]').forEach(td => td.style.display = 'none');
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
  document.querySelectorAll('.row-selected').forEach(tr => tr.classList.remove('row-selected'));
  updateBulkBar();
}

// ===== CHECKBOX BULK =====
function toggleSelectAll() {
  const checked = document.getElementById('selectAll').checked;
  document.querySelectorAll('.row-check').forEach(cb => {
    const id = parseInt(cb.dataset.id);
    cb.checked = checked;
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
    document.getElementById(`row-${id}`)?.classList.toggle('row-selected', checked);
  });
  updateBulkBar();
}

function toggleRow(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  document.getElementById(`row-${id}`)?.classList.toggle('row-selected', checked);

  const allChecks = document.querySelectorAll('.row-check');
  document.getElementById('selectAll').checked =
    allChecks.length > 0 && [...allChecks].every(cb => cb.checked);
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkActionBar');
  if (selectedIds.size > 0 && selectModeActive) {
    bar.style.display = 'flex';
    document.getElementById('bulkCount').textContent = `${selectedIds.size} data dipilih`;
  } else {
    bar.style.display = 'none';
  }
}

function confirmBulkDelete() {
  if (!selectedIds.size) return;
  deleteTargetIds = [...selectedIds];
  deleteTargetId  = 'bulk';
  document.getElementById('deleteModalTitle').textContent   = `Hapus ${selectedIds.size} Data?`;
  document.getElementById('deleteModalMessage').textContent = `${selectedIds.size} data yang dipilih akan dihapus. Lanjutkan?`;
  document.getElementById('deleteModal').style.display = 'flex';
}

// ===== EDIT MODAL =====
async function openEdit(id) {
  try {
    const res  = await fetch(`/api/record/${id}`);
    const data = await res.json();
    const rec  = data.data;
    if (!rec) return;

    document.getElementById('editRecordId').value    = rec.id;
    document.getElementById('edit_tanggal').value    = rec.tanggal_pembayaran || '';
    document.getElementById('edit_nama').value        = rec.nama || '';
    document.getElementById('edit_kelas').value       = rec.kelas || '';
    document.getElementById('edit_subjek').value      = rec.subjek || '';
    document.getElementById('edit_bulan_spp').value   = rec.bulan_spp || '';
    document.getElementById('edit_nominal_spp').value = rec.nominal_spp || '';
    document.getElementById('edit_verified').checked  = rec.is_verified || false;

    document.getElementById('editModal').style.display = 'flex';
  } catch {
    showToast('Gagal memuat data.', 'error');
  }
}

function closeModal() { document.getElementById('editModal').style.display = 'none'; }
function closeModalOutside(e) { if (e.target.id === 'editModal') closeModal(); }

async function saveEdit() {
  const id = document.getElementById('editRecordId').value;
  const payload = {
    tanggal_pembayaran: document.getElementById('edit_tanggal').value,
    nama:               document.getElementById('edit_nama').value,
    kelas:              document.getElementById('edit_kelas').value,
    subjek:             document.getElementById('edit_subjek').value,
    bulan_spp:          document.getElementById('edit_bulan_spp').value,
    nominal_spp:        parseFloat(document.getElementById('edit_nominal_spp').value) || null,
    is_verified:        document.getElementById('edit_verified').checked,
  };

  try {
    const res  = await fetch(`/api/record/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      loadRecords(currentPage);
      showToast('Data berhasil diperbarui!', 'success');
    } else {
      showToast(data.error || 'Gagal menyimpan.', 'error');
    }
  } catch { showToast('Terjadi kesalahan.', 'error'); }
}

// ===== DELETE MODAL (bug fix: pisah close dan execute) =====
function openDelete(id) {
  deleteTargetId  = id;
  deleteTargetIds = [];
  document.getElementById('deleteModalTitle').textContent   = 'Hapus Data';
  document.getElementById('deleteModalMessage').textContent = 'Apakah kamu yakin ingin menghapus data ini?';
  document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  // TIDAK reset deleteTargetId di sini agar executeDelete masih bisa pakai
}

function closeDeleteOutside(e) { if (e.target.id === 'deleteModal') closeDeleteModal(); }

async function executeDelete() {
  // Simpan dulu sebelum apapun
  const targetId  = deleteTargetId;
  const targetIds = [...deleteTargetIds];

  // Baru tutup modal
  document.getElementById('deleteModal').style.display = 'none';
  deleteTargetId  = null;
  deleteTargetIds = [];

  if (targetId === 'bulk') {
    try {
      let success = 0;
      for (const id of targetIds) {
        const res = await fetch(`/api/record/${id}`, { method: 'DELETE' });
        const d   = await res.json();
        if (d.success) success++;
      }
      showToast(`${success} data berhasil dihapus.`, 'success');
      selectedIds.clear();
      exitSelectMode();
      loadRecords(currentPage);
    } catch { showToast('Terjadi kesalahan.', 'error'); }
    return;
  }

  try {
    const res  = await fetch(`/api/record/${targetId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadRecords(currentPage);
      showToast('Data berhasil dihapus.', 'success');
    } else {
      showToast(data.error || 'Gagal menghapus.', 'error');
    }
  } catch { showToast('Terjadi kesalahan.', 'error'); }
}

// ===== HELPERS =====
function formatRupiah(num) { return Number(num).toLocaleString('id-ID'); }

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
