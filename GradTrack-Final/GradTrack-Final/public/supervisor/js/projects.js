import { db, auth } from '../../student/js/firebase-config.js';
import {
    collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, getDoc, setDoc, deleteDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let currentSupervisorUID = null;
let supervisorProjects = [];

// Global settings cache
let globalSettings = {
    teamMembersCount: 4,
    requiredProjectsCount: 3
};

// Load settings on module import
async function loadGlobalSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            globalSettings.teamMembersCount = data.teamMembersCount || 4;
            globalSettings.requiredProjectsCount = data.requiredProjectsCount || 3;
        }
    } catch (error) {
        console.error("Error loading global settings:", error);
    }
}

// Call on module load
loadGlobalSettings();

// ===========================================
// Notifications System
// ===========================================
let notifications = [];
let currentUserId = null;

// Set current user ID
export function setCurrentUserId(userId) {
    currentUserId = userId;
    console.log('✅ تم تعيين معرف المستخدم (مشرف):', userId);
}

// Load notifications from Firebase
export async function loadNotificationsFromFirebase() {
    if (!currentUserId) return;

    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUserId)
        );

        const snapshot = await getDocs(q);
        const dbNotifications = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                message: data.message,
                type: data.type || 'info',
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                read: data.read || false
            };
        });

        // دمج مع التنبيهات المحلية
        notifications = [...dbNotifications, ...notifications];
        updateNotificationUI();
        console.log('✅ تم تحميل التنبيهات من Firebase');
    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

// Setup real-time listener for notifications
export function setupNotificationListener() {
    if (!currentUserId) return;

    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUserId)
        );

        onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const newNotification = {
                        id: change.doc.id,
                        message: data.message,
                        type: data.type || 'info',
                        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                        read: data.read || false
                    };
                    // إضافة التنبيه الجديد في الأعلى
                    notifications.unshift(newNotification);
                    updateNotificationUI();
                    console.log('🔔 تنبيه جديد:', newNotification.message);
                }
            });
        });
    } catch (error) {
        console.error("Error setting up notification listener:", error);
    }
}

export function addNotification(message, type = 'info', duration = 5000) {
    const notification = {
        id: Date.now(),
        message,
        type, // 'info', 'success', 'warning', 'error'
        timestamp: new Date(),
        read: false
    };

    notifications.unshift(notification);
    updateNotificationUI();

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeNotification(notification.id);
        }, duration);
    }
}

function removeNotification(id) {
    notifications = notifications.filter(n => n.id !== id);
    updateNotificationUI();

    // حذف من Firebase
    deleteFromFirebase(id);
}

async function deleteFromFirebase(notificationId) {
    try {
        // البحث عن المستند بـ id
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUserId)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
            if (doc.id === notificationId) {
                deleteDoc(doc.ref);
            }
        });
    } catch (error) {
        console.error("Error deleting notification from Firebase:", error);
    }
}

export function removeNotificationExport(id) {
    removeNotification(id);
}

export function clearAllNotifications() {
    notifications = [];
    updateNotificationUI();

    // حذف جميع التنبيهات من Firebase
    clearAllFromFirebase();
}

async function clearAllFromFirebase() {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUserId)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
            deleteDoc(doc.ref);
        });
    } catch (error) {
        console.error("Error clearing notifications from Firebase:", error);
    }
}

function updateNotificationUI() {
    const badge = document.getElementById('notificationBadge');
    const list = document.getElementById('notificationsList');

    const unreadCount = notifications.filter(n => !n.read).length;

    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (list) {
        if (notifications.length === 0) {
            list.innerHTML = '<div style="padding: 30px 20px; text-align: center; color: #999;"><p>لا توجد تنبيهات جديدة</p></div>';
        } else {
            list.innerHTML = notifications.map(n => `
                <div style="padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; background: ${n.read ? '#fff' : '#f0f7ff'}; transition: background 0.2s;" onclick="window.supervisorApp.markNotificationAsRead(${n.id})">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px;">
                        <div style="flex: 1;">
                            <p style="margin: 0 0 5px 0; font-weight: ${n.read ? 'normal' : 'bold'}; color: #333;">${getNotificationIcon(n.type)} ${n.message}</p>
                            <small style="color: #999;">${formatTime(n.timestamp)}</small>
                        </div>
                        <button onclick="event.stopPropagation(); window.supervisorApp.removeNotification(${n.id})" style="background: none; border: none; color: #ff4444; cursor: pointer; font-size: 1.2em;">✕</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function getNotificationIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || '📌';
}

function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `قبل ${minutes} دقيقة`;
    if (hours < 24) return `قبل ${hours} ساعة`;
    if (days < 7) return `قبل ${days} يوم`;
    return date.toLocaleDateString('ar-EG');
}

export function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        // Mark all as read when opening
        notifications.forEach(n => n.read = true);
        updateNotificationUI();
    }
}

export function markNotificationAsRead(id) {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
        notification.read = true;
        updateNotificationUI();
    }
}

// Initialize function to be called from main.js when page loads
export async function initProjects(user) {
    currentSupervisorUID = user.uid;
    await loadSupervisorData();
    await loadProjects();
}

// Load supervisor data
async function loadSupervisorData() {
    try {
        const supervisorDoc = await getDoc(doc(db, 'supervisors', currentSupervisorUID));
        let supervisorData = null;

        if (!supervisorDoc.exists()) {
            // Create Doc if missing
            supervisorData = {
                uid: currentSupervisorUID,
                email: auth.currentUser.email,
                createdAt: new Date()
            };
            await setDoc(doc(db, 'supervisors', currentSupervisorUID), supervisorData, { merge: true });
        } else {
            supervisorData = supervisorDoc.data();
        }
    } catch (error) {
        console.error("Error loading supervisor data:", error);
    }
}

// Show project form modal
function showProjectForm() {
    // Reload settings to get latest values
    loadGlobalSettings().then(() => {
        const maxProjects = globalSettings.requiredProjectsCount || 3;

        // Check if we've reached the maximum
        if (supervisorProjects.length >= maxProjects) {
            alert(`❌ تم الوصول للحد الأقصى من المشاريع\n\nالحد الأقصى المسموح به: ${maxProjects} مشاريع\nعدد المشاريع الحالي: ${supervisorProjects.length}`);
            return;
        }

        // Calculate next project number
        const nextNumber = supervisorProjects.length + 1;
        const numInput = document.getElementById('projectNumber');
        if (numInput) numInput.value = `المشروع رقم ${nextNumber}`;

        // Show modal
        const modal = document.getElementById('addProjectModal');
        if (modal) modal.style.display = 'flex';
    });
}

// Close project modal
function closeProjectModal() {
    const modal = document.getElementById('addProjectModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('addProjectForm');
    if (form) form.reset();
}

// Add new project
async function addProject(event) {
    event.preventDefault();

    // Reload settings to ensure we have the latest
    await loadGlobalSettings();
    const maxProjects = globalSettings.requiredProjectsCount || 3;

    // Final check before adding project
    if (supervisorProjects.length >= maxProjects) {
        addNotification(`❌ تم الوصول للحد الأقصى من المشاريع (${maxProjects})`, "error", 4000);
        return;
    }

    const title = document.getElementById('projectTitle').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const studyTypeEl = document.querySelector('input[name="studyType"]:checked');
    const studyType = studyTypeEl ? studyTypeEl.value : 'صباحية';

    console.log('📝 نوع الدراسة المختار:', studyType);
    console.log('🔍 العنصر المختار:', studyTypeEl);

    if (!title || !description) {
        addNotification("⚠️ يرجى ملء جميع الحقول", "warning", 3000);
        return;
    }

    const projectNumber = supervisorProjects.length + 1;

    try {
        // Get supervisor name
        const supervisorDoc = await getDoc(doc(db, 'supervisors', currentSupervisorUID));
        const supervisorData = supervisorDoc.data();
        const supervisorName = supervisorData.fullName || supervisorData.email.split('@')[0];

        // Add project to Firestore
        const projectRef = await addDoc(collection(db, 'projects'), {
            supervisorUID: currentSupervisorUID,
            supervisorName: supervisorName,
            projectNumber: projectNumber,
            title: title,
            description: description,
            targetStudyType: studyType,
            status: 'available',
            assignedTeamCode: null, // Initial state
            assignedTeamName: null,
            maxTeamSize: 4,
            isPublished: false,
            createdAt: new Date()
        });

        console.log('Project added with ID:', projectRef.id);

        // Update supervisor's project count
        await updateDoc(doc(db, 'supervisors', currentSupervisorUID), {
            projectsCount: projectNumber
        });

        // Close modal and reload projects
        closeProjectModal();
        await loadProjects();

        addNotification(`✅ تم إضافة المشروع "${title}" بنجاح!`, "success", 5000);

    } catch (error) {
        console.error('Error adding project:', error);
        alert('❌ حدث خطأ أثناء إضافة المشروع');
    }
}

// Load all supervisor's projects
async function loadProjects() {
    try {
        // Query projects by supervisorUID only (Composite Index workaround)
        // We will sort client-side to avoid needing a custom index creation link
        const projectsQuery = query(
            collection(db, 'projects'),
            where('supervisorUID', '==', currentSupervisorUID)
        );

        const snapshot = await getDocs(projectsQuery);
        supervisorProjects = [];

        const container = document.getElementById('projectsContainer');
        if (!container) return;

        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>لم تقم بإضافة أي مشروع بعد</p>
          <p style="font-size: 0.9em; color: #666;">اضغط على "إضافة مشروع جديد" للبدء</p>
        </div>
      `;
            const publishBtn = document.getElementById('publishBtn');
            if (publishBtn) publishBtn.style.display = 'none';
            return;
        }

        snapshot.forEach(doc => {
            const project = { id: doc.id, ...doc.data() };
            supervisorProjects.push(project);
        });

        // Client-side Sort: Newest First
        supervisorProjects.sort((a, b) => {
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });

        // Render sorted projects
        supervisorProjects.forEach(project => {
            const card = createProjectCard(project);
            container.appendChild(card);
        });

        // Show publish button if there are projects
        const publishBtn = document.getElementById('publishBtn');
        if (publishBtn) publishBtn.style.display = supervisorProjects.length > 0 ? 'block' : 'none';

    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Create project card element
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.setAttribute('data-project-id', project.id);

    // Study type badge color
    let badgeClass = 'badge-both';
    let badgeText = 'الكل';
    if (project.targetStudyType === 'صباحية') { badgeClass = 'badge-morning'; badgeText = 'صباحية'; }
    else if (project.targetStudyType === 'مسائية') { badgeClass = 'badge-evening'; badgeText = 'مسائية'; }

    card.innerHTML = `
    <div class="project-card-inner">
      
      <!-- Card Header: Title & Badge -->
      <div class="card-header-row">
        <h3 class="project-title">${project.title}</h3>
        <span class="study-badge ${badgeClass}">${badgeText}</span>
      </div>

      <!-- Card Body: Description -->
      <div class="card-body-row">
        <p class="project-description">${project.description}</p>
      </div>

      <!-- Card Footer: Sequence Number & Actions -->
      <div class="card-footer-row">
        <div class="project-sequence">
            <span class="sequence-label">التسلسل:</span>
            <span class="sequence-number">#${project.projectNumber}</span>
        </div>
        
        <button class="btn-delete-project" onclick="deleteProject('${project.id}')" title="حذف المشروع">
          🗑️ حذف
        </button>
      </div>

    </div>
  `;
    return card;
}

// Publish all projects
async function publishAllProjects() {
    if (!confirm('هل أنت متأكد من نشر جميع المشاريع؟ سيتمكن الطلاب من رؤيتها واختيارها.')) {
        return;
    }

    try {
        const updatePromises = supervisorProjects
            .filter(p => !p.isPublished)
            .map(p => updateDoc(doc(db, 'projects', p.id), { isPublished: true }));

        await Promise.all(updatePromises);

        alert('✅ تم نشر جميع المشاريع بنجاح! يمكن للطلاب الآن مشاهدتها واختيارها.');

        await loadProjects();

    } catch (error) {
        console.error('Error publishing projects:', error);
        alert('❌ حدث خطأ أثناء النشر');
    }
}

// Edit project
async function editProject(projectId) {
    // Implementation for editing project
    alert('🔧 سيتم فتح نموذج التعديل قريباً');
}

// Delete project
async function deleteProject(projectId) {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'projects', projectId));
        alert('✅ تم حذف المشروع بنجاح');
        await loadProjects();
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('❌ حدث خطأ أثناء الحذف');
    }
}

// Export functions to window as per SOP requirement
window.showProjectForm = showProjectForm;
window.closeProjectModal = closeProjectModal;
window.addProject = addProject;
window.publishAllProjects = publishAllProjects;
window.editProject = editProject;
window.deleteProject = deleteProject;
