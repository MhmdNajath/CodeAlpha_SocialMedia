/* ========================================
   α.Social - Client-Side JavaScript
   ======================================== */

// ---- SweetAlert Toast Helper ----
function showToast(type, message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type,
            title: message,
            showConfirmButton: true,
            confirmButtonText: 'OK',
            confirmButtonColor: '#6c5ce7',
            timer: 3000,
            timerProgressBar: true,
            background: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#12122a',
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e8e8f0'
        });
    }
}

// ---- Theme toggle ----
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    const root = document.documentElement;

    // Set correct icon on load
    if (root.getAttribute('data-theme') === 'light') {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    themeToggle.addEventListener('click', () => {
        const isLight = root.getAttribute('data-theme') === 'light';
        const newTheme = isLight ? 'dark' : 'light';
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.innerHTML = isLight
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    });
}

// ---- Image preview for post creation ----
const fileInput = document.querySelector('input[name="image"]');
if (fileInput) {
    fileInput.addEventListener('change', function () {
        const preview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
}

// ---- Mobile nav toggle ----
const navToggle = document.getElementById('navToggle');
if (navToggle) {
    navToggle.addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });
}

// ---- Logout confirmation ----
const logoutBtn = document.querySelector('.nav-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (typeof Swal !== 'undefined') {
            const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#12122a';
            const fg = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e8e8f0';
            const result = await Swal.fire({
                title: 'Leave now?',
                text: 'Are you sure you want to log out?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#6c5ce7',
                confirmButtonText: 'Yes, log out',
                background: bg,
                color: fg
            });
            if (result.isConfirmed) {
                window.location.href = logoutBtn.href;
            }
        } else {
            if (confirm('Are you sure you want to log out?')) {
                window.location.href = logoutBtn.href;
            }
        }
    });
}

// ---- Password toggle ----
const passwordToggles = document.querySelectorAll('.password-toggle');
passwordToggles.forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
});

// ---- Search ----
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();
        if (query.length < 2) {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
            return;
        }
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/search/users?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.users && data.users.length > 0) {
                    searchResults.innerHTML = data.users.map(u => `
                        <a href="/profile/${u.username}" class="search-result-item">
                            <img src="${u.avatar || `https://ui-avatars.com/api/?name=${u.display_name || u.username}&background=6c5ce7&color=fff`}"
                                onerror="this.src='https://ui-avatars.com/api/?name=${u.display_name || u.username}&background=6c5ce7&color=fff'" alt="${u.username}">
                            <div class="result-info">
                                <strong>${u.display_name || u.username}</strong>
                                <span>@${u.username}</span>
                            </div>
                        </a>
                    `).join('');
                    searchResults.classList.add('active');
                } else {
                    searchResults.innerHTML = '<p style="padding:12px; color: var(--text-muted); text-align:center; font-size:0.88rem">No users found</p>';
                    searchResults.classList.add('active');
                }
            } catch (err) {
                console.error('Search error:', err);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });
}

// ---- Remove image preview ----
function removePreview() {
    const preview = document.getElementById('imagePreview');
    const fi = document.querySelector('input[name="image"]');
    if (preview) preview.style.display = 'none';
    if (fi) fi.value = '';
}

// ---- Toggle Like (AJAX) ----
async function toggleLike(postId, btn) {
    try {
        const res = await fetch(`/posts/${postId}/like`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            const icon = btn.querySelector('i');
            const count = btn.querySelector('.like-count');
            count.textContent = data.likeCount;
            if (data.isLiked) {
                btn.classList.add('liked');
                icon.className = 'fas fa-heart';
                showToast('success', 'Post liked!');
            } else {
                btn.classList.remove('liked');
                icon.className = 'far fa-heart';
                showToast('success', 'Post unliked!');
            }
        }
    } catch (err) {
        console.error('Like error:', err);
        showToast('error', 'Failed to toggle like');
    }
}

// ---- Toggle Comments ----
async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    const list = document.getElementById(`comments-list-${postId}`);

    if (section.style.display === 'none') {
        section.style.display = 'block';
        try {
            const res = await fetch(`/posts/${postId}/comments`);
            const data = await res.json();
            if (data.success) {
                list.innerHTML = data.comments.length === 0
                    ? '<p class="text-muted" style="text-align:center; padding: 12px;">No comments yet. Be the first!</p>'
                    : data.comments.map(c => renderComment(c)).join('');
            }
        } catch (err) {
            console.error('Load comments error:', err);
        }
    } else {
        section.style.display = 'none';
    }
}

// ---- Add Comment (AJAX) ----
async function addComment(event, postId) {
    event.preventDefault();
    const form = event.target;
    const input = form.querySelector('.comment-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        const res = await fetch(`/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (data.success) {
            const list = document.getElementById(`comments-list-${postId}`);
            const noComments = list.querySelector('.text-muted');
            if (noComments) noComments.remove();
            list.innerHTML += renderComment(data.comment);
            input.value = '';
            const card = document.getElementById(`post-${postId}`);
            const commentCount = card.querySelector('.comment-count');
            commentCount.textContent = data.commentCount;
            list.scrollTop = list.scrollHeight;
            showToast('success', 'Comment added!');
        } else {
            showToast('error', data.message || 'Failed to add comment');
        }
    } catch (err) {
        console.error('Comment error:', err);
        showToast('error', 'Something went wrong');
    }
}

// ---- Render Comment HTML ----
function renderComment(c) {
    const avatarUrl = c.avatar || `https://ui-avatars.com/api/?name=${c.display_name || c.username}&background=6c5ce7&color=fff`;
    const time = c.created_at === 'Just now' ? 'Just now' : timeAgo(c.created_at);
    return `
    <div class="comment-item">
      <img src="${avatarUrl}" alt="${c.username}" onerror="this.src='https://ui-avatars.com/api/?name=${c.display_name || c.username}&background=6c5ce7&color=fff'">
      <div class="comment-body">
        <a href="/profile/${c.username}" class="comment-author">${c.display_name || c.username}</a>
        <span class="comment-text">${escapeHtml(c.content)}</span>
        <div class="comment-time">${time}</div>
      </div>
    </div>
  `;
}

// ---- Delete Post ----
async function deletePost(postId) {
    if (typeof Swal !== 'undefined') {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#12122a';
        const fg = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e8e8f0';
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            cancelButtonColor: '#6c5ce7',
            confirmButtonText: 'Yes, delete it!',
            background: bg,
            color: fg
        });
        if (!result.isConfirmed) return;
    } else {
        if (!confirm('Are you sure you want to delete this post?')) return;
    }

    try {
        const res = await fetch(`/posts/${postId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            const card = document.getElementById(`post-${postId}`);
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => card.remove(), 300);
            showToast('success', 'Post deleted!');
        } else {
            showToast('error', data.message || 'Failed to delete post');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showToast('error', 'Something went wrong');
    }
}

// ---- Toggle Follow (AJAX) ----
async function toggleFollow(userId, btn) {
    try {
        const res = await fetch(`/follow/${userId}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            if (data.isFollowing) {
                btn.classList.remove('btn-primary', 'btn-outline');
                btn.classList.add('btn-outline', 'following-btn');
                btn.innerHTML = '<i class="fas fa-user-check"></i> Following';
                showToast('success', 'Started following!');
            } else {
                btn.classList.remove('btn-outline', 'following-btn');
                btn.classList.add('btn-primary');
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
                showToast('info', 'Unfollowed user');
            }
            const followerDisplay = document.querySelector('.follower-count-display');
            if (followerDisplay) followerDisplay.textContent = data.followerCount;
        }
    } catch (err) {
        console.error('Follow error:', err);
        showToast('error', 'Failed to toggle follow');
    }
}

// ---- Edit Profile Modal ----
function openEditModal() {
    document.getElementById('editModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    document.body.style.overflow = '';
}

// ---- Followers/Following Modal ----
async function showFollowers(username) {
    const modal = document.getElementById('userListModal');
    const title = document.getElementById('userListTitle');
    const content = document.getElementById('userListContent');
    title.textContent = 'Followers';
    content.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    try {
        const res = await fetch(`/profile/${username}/followers`);
        const data = await res.json();
        if (data.success) {
            content.innerHTML = data.followers.length === 0
                ? '<p class="text-muted" style="text-align:center;">No followers yet</p>'
                : data.followers.map(u => renderUserListItem(u)).join('');
        }
    } catch (err) {
        content.innerHTML = '<p class="text-muted">Failed to load</p>';
    }
}

async function showFollowing(username) {
    const modal = document.getElementById('userListModal');
    const title = document.getElementById('userListTitle');
    const content = document.getElementById('userListContent');
    title.textContent = 'Following';
    content.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    try {
        const res = await fetch(`/profile/${username}/following`);
        const data = await res.json();
        if (data.success) {
            content.innerHTML = data.following.length === 0
                ? '<p class="text-muted" style="text-align:center;">Not following anyone</p>'
                : data.following.map(u => renderUserListItem(u)).join('');
        }
    } catch (err) {
        content.innerHTML = '<p class="text-muted">Failed to load</p>';
    }
}

function closeUserListModal() {
    document.getElementById('userListModal').style.display = 'none';
    document.body.style.overflow = '';
}

function renderUserListItem(u) {
    const avatarUrl = u.avatar || `https://ui-avatars.com/api/?name=${u.display_name || u.username}&background=6c5ce7&color=fff`;
    return `
    <a href="/profile/${u.username}" class="user-list-item" style="color: var(--text-primary);">
      <img src="${avatarUrl}" alt="${u.username}" onerror="this.src='https://ui-avatars.com/api/?name=${u.display_name || u.username}&background=6c5ce7&color=fff'">
      <div class="user-list-item-info">
        <strong>${u.display_name || u.username}</strong>
        <span>@${u.username}</span>
        ${u.bio ? `<p>${u.bio}</p>` : ''}
      </div>
    </a>
  `;
}

// ---- Helper: Time Ago ----
function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- Helper: Escape HTML ----
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ---- Close modals on overlay click ----
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
        document.body.style.overflow = '';
    }
});

// ---- Close modals on Escape ----
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.style.display = 'none';
        });
        document.body.style.overflow = '';
    }
});
