const usersList = document.getElementById('usersList');
const permissionMessage = document.getElementById('permissionMessage');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

async function loadUsers() {
  permissionMessage.textContent = 'جاري تحميل المستخدمين...';

  try {
    const response = await fetch('/api/permissions/users', {
      credentials: 'include'
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'تعذر تحميل المستخدمين');
    }

    usersList.innerHTML = data.users.map(user => {
      const owner = user.role === 'owner';
      const enabled = user.can_publish === true;
      const name = escapeHtml(user.full_name || 'مستخدم');
      const email = escapeHtml(user.email || '');
      const id = escapeHtml(user.id);

      return `
        <article class="permission-card">
          <div class="permission-user">
            <strong>${name}${owner ? ' (المالك)' : ''}</strong>
            <small>${email}</small>
            <div class="permission-state">
              ${owner ? 'صلاحية النشر متاحة للمالك دائماً' :
                enabled ? 'لديه صلاحية النشر' : 'ليس لديه صلاحية النشر'}
            </div>
          </div>
          ${owner ? '' : `
            <button class="permission-button ${enabled ? 'revoke' : ''}"
              type="button" data-user-id="${id}" data-enabled="${enabled}">
              ${enabled ? 'سحب صلاحية النشر' : 'منح صلاحية النشر'}
            </button>`}
        </article>`;
    }).join('');

    permissionMessage.textContent = 'تم تحميل المستخدمين.';
  } catch (error) {
    permissionMessage.textContent = error.message;
    usersList.innerHTML = '';
  }
}

usersList.addEventListener('click', async event => {
  const button = event.target.closest('button[data-user-id]');
  if (!button) return;

  const canPublish = button.dataset.enabled !== 'true';
  button.disabled = true;

  try {
    const response = await fetch(
      '/api/permissions/users/' + encodeURIComponent(button.dataset.userId),
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ can_publish: canPublish })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'تعذر تعديل الصلاحية');
    }

    permissionMessage.textContent = data.message;
    await loadUsers();
  } catch (error) {
    permissionMessage.textContent = error.message;
    button.disabled = false;
  }
});

loadUsers();
