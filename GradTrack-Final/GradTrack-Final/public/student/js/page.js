import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, Timestamp, onSnapshot, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
    console.log('✅ تم تعيين معرف المستخدم:', userId);
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
                <div style="padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; background: ${n.read ? '#fff' : '#f0f7ff'}; transition: background 0.2s;" onclick="window.dashboardApp.markNotificationAsRead(${n.id})">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px;">
                        <div style="flex: 1;">
                            <p style="margin: 0 0 5px 0; font-weight: ${n.read ? 'normal' : 'bold'}; color: #333;">${getNotificationIcon(n.type)} ${n.message}</p>
                            <small style="color: #999;">${formatTime(n.timestamp)}</small>
                        </div>
                        <button onclick="event.stopPropagation(); window.dashboardApp.removeNotification(${n.id})" style="background: none; border: none; color: #ff4444; cursor: pointer; font-size: 1.2em;">✕</button>
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


// ===========================================
// Dashboard & Navigation Logic
// ===========================================

export function showDashboardHome() {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="welcome-message">
            <h1>مرحباً بك في نظام GradTrack 🎓</h1>
            <p>اختر أحد القوائم أعلاه للبدء</p>
            <p>يمكنك انشاء فريق والتقديم على مشروع التخرج</p>
        </div>
    `;
}

// ===========================================
// Project Logic
// ===========================================

let selectedAvailableProject = null;
let selectedChosenProject = null;

export async function showCurrentProjectPage() {
    const contentArea = document.querySelector('.content-area');

    contentArea.innerHTML = `
        <div class="current-project-container">
            <div class="page-header">
                <h2>📊 مشروعي الحالي</h2>
            </div>
            <div id="projectLoading" style="text-align:center; padding:40px;">
                <div class="spinner" style="margin:0 auto;"></div>
                <p>جاري تحميل بيانات المشروع...</p>
            </div>
            <div id="projectContent" style="display:none;"></div>
        </div>
    `;

    try {
        const user = auth.currentUser;
        if (!user) {
            contentArea.innerHTML = `<div style="padding:20px; color:red;">❌ يرجى تسجيل الدخول</div>`;
            return;
        }

        const studentDoc = await getDoc(doc(db, "students", user.uid));
        if (!studentDoc.exists()) {
            contentArea.innerHTML = `<div style="padding:20px; color:red;">❌ بيانات الطالب غير موجودة</div>`;
            return;
        }

        const studentData = studentDoc.data();

        if (!studentData.assignedProject || !studentData.assignedProject.id) {
            document.getElementById('projectLoading').style.display = 'none';
            document.getElementById('projectContent').style.display = 'block';
            document.getElementById('projectContent').innerHTML = `
                <div style="background: white; border-radius: 15px; padding: 40px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="font-size: 4em; margin-bottom: 20px;">⏳</div>
                    <h3 style="color: #333; margin: 10px 0;">لم يتم تخصيص مشروع لك بعد</h3>
                    <p style="color: #666; font-size: 1.1em;">يرجى انتظار انتهاء عملية التوزيع من قبل الإدارة.</p>
                </div>
            `;
            return;
        }

        // Project Assigned! Fetch details
        const projectId = studentData.assignedProject.id;
        const projectDoc = await getDoc(doc(db, "projects", projectId));
        const projectData = projectDoc.exists() ? projectDoc.data() : { title: studentData.assignedProject.title, description: 'غير متوفر' };

        // Fetch Team Members
        let teamMembersHtml = '';
        if (studentData.teamCode) {
            const teamDoc = await getDoc(doc(db, "teams", studentData.teamCode));
            if (teamDoc.exists()) {
                const teamData = teamDoc.data();
                if (teamData.memberUIDs) {
                    // We need names. iterate
                    for (const uid of teamData.memberUIDs) {
                        // Optimize: check if we have data, or just fetch.
                        // For simplicity, fetch is okay for small team
                        const memDoc = await getDoc(doc(db, "students", uid));
                        const memName = memDoc.exists() ? (memDoc.data().fullName || 'عضو') : 'عضو';
                        teamMembersHtml += `<li style="margin-bottom:5px;">👤 ${memName}</li>`;
                    }
                }
            }
        }

        document.getElementById('projectLoading').style.display = 'none';
        const projectContent = document.getElementById('projectContent');
        projectContent.style.display = 'block';

        projectContent.innerHTML = `
            <div class="project-name-card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white;">
                <div class="project-icon" style="background:rgba(255,255,255,0.2);">🎯</div>
                <div class="project-name-content">
                    <h3 style="color:white;">${projectData.title}</h3>
                    <div class="project-status">
                         <span class="status-badge active" style="background:white; color:#667eea;">✅ تم الاعتماد</span>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-top:30px;">
                
                <!-- Supervisor Card -->
                <div style="background:white; padding:25px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color:#333; border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0;">👨‍🏫 المشرف</h3>
                    <p style="font-size:1.2em; color:#2d3748; font-weight:bold;">${studentData.supervisorName || 'غير محدد'}</p>
                    <p style="color:#718096; font-size:0.9em;">مشرف المشروع</p>
                </div>

                <!-- Team Card -->
                <div style="background:white; padding:25px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color:#333; border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0;">👥 فريق العمل</h3>
                    <ul style="list-style:none; padding:0; color:#4a5568;">
                        ${teamMembersHtml}
                    </ul>
                </div>

                <!-- Description Card -->
                <div style="background:white; padding:25px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.05); grid-column: 1 / -1;">
                    <h3 style="color:#333; border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0;">📝 وصف المشروع</h3>
                    <p style="color:#4a5568; line-height:1.6;">${projectData.description}</p>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error loading current project:", error);
        contentArea.innerHTML = `<div style="padding:20px; color:red;">❌ حدث خطأ: ${error.message}</div>`;
    }
}

export async function showProjectSelectionPage() {
    const contentArea = document.querySelector('.content-area');

    // أولاً: التحقق من الإعدادات
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};

        // إذا لم يسمح بعرض المشاريع
        if (!settings.allowStudentView) {
            contentArea.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <div style="background: white; border-radius: 15px; padding: 40px; max-width: 600px; margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,0.1);">
                        <div style="font-size: 4em; margin-bottom: 20px;">🔒</div>
                        <h2 style="color: #333; margin: 20px 0;">عرض المشاريع غير متاح</h2>
                        <p style="color: #666; font-size: 1.1em; line-height: 1.8;">
                            عذراً، لا يُسمح برؤية المشاريع في الوقت الحالي.<br>
                            يرجى انتظار إعلان الإدارة.
                        </p>
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin-top: 30px; color: #666;">
                            <p style="margin: 0;">📌 سيتم فتح الوصول قريباً</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
    } catch (error) {
        console.error("Error checking settings:", error);
    }

    contentArea.innerHTML = `
        <div class="project-selection-container">
            <h2>📊 اختيار المشروع</h2>
            <div id="project-selection-loading" style="text-align:center; padding:40px;">
                <div class="spinner" style="margin:0 auto;"></div>
                <p>جاري تحميل المشاريع...</p>
            </div>
            <div id="project-selection-content" style="display:none;">
                <div id="publishWarning" style="display:none; background: #fff3cd; border: 2px solid #ffc107; border-radius: 10px; padding: 15px; margin-bottom: 20px; text-align: center;">
                    <p style="color: #856404; margin: 0; font-weight: 500;">⏳ يمكنك معاينة المشاريع، لكن التأكيد غير متاح حالياً - انتظر بدء العملية الرسمية</p>
                </div>
                <div class="selection-layout">
                    <div class="project-list-card">
                        <h3>المشاريع المتاحة</h3>
                        <div class="projects-list" id="availableProjects">
                            <div class="empty-state">
                                <div class="empty-state-icon">📋</div>
                                <p>لا توجد مشاريع متاحة حالياً</p>
                            </div>
                        </div>
                    </div>

                    <div class="move-buttons">
                        <button class="move-btn" onclick="window.dashboardApp.moveToSelected()" id="moveRightBtn">◀</button>
                        <button class="move-btn" onclick="window.dashboardApp.moveToAvailable()" id="moveLeftBtn">▶</button>
                    </div>

                    <div class="project-list-card">
                        <h3>مشاريعي المختارة</h3>
                        <div class="projects-list" id="selectedProjects">
                            <div class="empty-state">
                                <div class="empty-state-icon">📋</div>
                                <p>لم تقم باختيار أي مشروع بعد</p>
                            </div>
                        </div>
                        
                        <div class="controls-section" style="margin-top: 20px; justify-content: center;">
                            <div class="reorder-buttons">
                                <button class="reorder-btn" onclick="window.dashboardApp.moveUp()" id="moveUpBtn" disabled>⬆ للأعلى</button>
                                <button class="reorder-btn" onclick="window.dashboardApp.moveDown()" id="moveDownBtn" disabled>⬇ للأسفل</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="window.dashboardApp.confirmSelection()" id="confirmBtn" disabled>✅ تأكيد الاختيار</button>
                    <button class="btn btn-secondary" onclick="window.dashboardApp.resetSelection()" id="resetBtn">🔄 إعادة تعيين</button>
                </div>
            </div>
        </div>
    `;

    selectedAvailableProject = null;
    selectedChosenProject = null;

    // Load projects from Firestore
    try {
        // التحقق من حالة النشر وعرض التحذير إذا لزم الأمر
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};

        const warningDiv = document.getElementById('publishWarning');
        if (warningDiv && !settings.projectsPublished) {
            warningDiv.style.display = 'block';
            // تعطيل زر التأكيد
            const confirmBtn = document.getElementById('confirmBtn');
            if (confirmBtn) confirmBtn.disabled = true;
        }

        await loadProjectsFromFirestore();
    } catch (error) {
        console.error("Error loading projects:", error);
        contentArea.innerHTML = `
            <div class="error-message">
                <h3>❌ حدث خطأ في تحميل المشاريع</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="window.dashboardApp.loadPage('select-project')">إعادة المحاولة</button>
            </div>
        `;
    }
}

export function selectAvailableProject(element) {
    document.querySelectorAll('#availableProjects .project-item').forEach(item => item.classList.remove('selected'));
    if (selectedChosenProject) {
        selectedChosenProject.classList.remove('selected');
        selectedChosenProject = null;
    }
    element.classList.add('selected');
    selectedAvailableProject = element;
    updateProjectButtons();
}

export function selectChosenProject(element) {
    document.querySelectorAll('#selectedProjects .project-item').forEach(item => item.classList.remove('selected'));
    if (selectedAvailableProject) {
        selectedAvailableProject.classList.remove('selected');
        selectedAvailableProject = null;
    }
    element.classList.add('selected');
    selectedChosenProject = element;
    updateProjectButtons();
}

export function moveToSelected() {
    if (!selectedAvailableProject) return;
    const selectedList = document.getElementById('selectedProjects');
    const emptyState = selectedList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const projectCount = selectedList.querySelectorAll('.project-item').length + 1;
    const clonedProject = selectedAvailableProject.cloneNode(true);

    const priorityBadge = document.createElement('div');
    priorityBadge.className = 'project-priority';
    priorityBadge.textContent = `#${projectCount}`;
    clonedProject.appendChild(priorityBadge);

    clonedProject.setAttribute('onclick', 'window.dashboardApp.selectChosenProject(this)');
    clonedProject.classList.remove('selected');
    selectedList.appendChild(clonedProject);

    selectedAvailableProject.remove();
    selectedAvailableProject = null;
    updateProjectButtons();
}

export function moveToAvailable() {
    if (!selectedChosenProject) return;
    const availableList = document.getElementById('availableProjects');
    const clonedProject = selectedChosenProject.cloneNode(true);

    const badge = clonedProject.querySelector('.project-priority');
    if (badge) badge.remove();

    clonedProject.setAttribute('onclick', 'window.dashboardApp.selectAvailableProject(this)');
    clonedProject.classList.remove('selected');

    // Remove empty state if exists
    const emptyState = availableList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    availableList.appendChild(clonedProject);

    selectedChosenProject.remove();
    selectedChosenProject = null;
    updatePriorities();
    updateProjectButtons();

    const selectedList = document.getElementById('selectedProjects');
    if (selectedList && selectedList.querySelectorAll('.project-item').length === 0) {
        selectedList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>لم تقم باختيار أي مشروع بعد</p>
            </div>
        `;
    }
}

export function moveUp() {
    if (!selectedChosenProject) return;
    const prev = selectedChosenProject.previousElementSibling;
    if (prev) {
        selectedChosenProject.parentNode.insertBefore(selectedChosenProject, prev);
        updatePriorities();
        updateProjectButtons();
    }
}

export function moveDown() {
    if (!selectedChosenProject) return;
    const next = selectedChosenProject.nextElementSibling;
    if (next) {
        selectedChosenProject.parentNode.insertBefore(next, selectedChosenProject);
        updatePriorities();
        updateProjectButtons();
    }
}

function updatePriorities() {
    const selectedList = document.getElementById('selectedProjects');
    if (!selectedList) return;

    const items = selectedList.querySelectorAll('.project-item');
    items.forEach((item, index) => {
        let badge = item.querySelector('.project-priority');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'project-priority';
            item.appendChild(badge);
        }
        badge.textContent = `#${index + 1}`;
    });
}

function updateProjectButtons() {
    const moveRightBtn = document.getElementById('moveRightBtn');
    if (!moveRightBtn) return;

    moveRightBtn.disabled = !selectedAvailableProject;
    document.getElementById('moveLeftBtn').disabled = !selectedChosenProject;
    document.getElementById('moveUpBtn').disabled = !selectedChosenProject || !selectedChosenProject.previousElementSibling;
    document.getElementById('moveDownBtn').disabled = !selectedChosenProject || !selectedChosenProject.nextElementSibling;

    const len = document.getElementById('selectedProjects').querySelectorAll('.project-item').length;
    document.getElementById('confirmBtn').disabled = len === 0;
}

async function loadProjectsFromFirestore() {
    const loadingDiv = document.getElementById('project-selection-loading');
    const contentDiv = document.getElementById('project-selection-content');

    try {
        // Get current user's team
        const user = auth.currentUser;
        if (!user) {
            throw new Error("يجب تسجيل الدخول أولاً");
        }

        const studentDoc = await getDoc(doc(db, "students", user.uid));
        if (!studentDoc.exists()) {
            // For supervisors or admins viewing this page by mistake
            throw new Error("عذراً، هذا الحساب ليس حساب طالب (لا توجد بيانات طالب).");
        }

        const studentData = studentDoc.data();
        const studentStudyType = studentData.studyType || 'صباحية'; // الحصول على نوع الدراسة - القيم: صباحية أو مسائية
        console.log('🎓 نوع الدراسة الحالي:', studentStudyType);

        if (!studentData.teamCode) {
            throw new Error("يجب أن تكون في فريق أولاً");
        }

        // Get team data
        const teamDoc = await getDoc(doc(db, "teams", studentData.teamCode));
        if (!teamDoc.exists()) {
            throw new Error("بيانات الفريق غير موجودة");
        }

        const teamData = teamDoc.data();

        // Check if team is locked
        if (teamData.isLocked) {
            document.getElementById('project-selection-content').innerHTML = `
                <div class="error-message">
                    <h3>🔒 تم قفل الاختيار</h3>
                    <p>لقد قمت بتسليم الرغبات مسبقاً. لا يمكن التعديل الآن.</p>
                </div>
            `;
            loadingDiv.style.display = 'none';
            return;
        }

        // Fetch available projects - بدون فلترة أولية، سنفلتر يدويّاً
        const projectsQuery = query(
            collection(db, "projects"),
            where("status", "==", "available")
        );
        const projectsSnapshot = await getDocs(projectsQuery);

        const availableProjectsDiv = document.getElementById('availableProjects');
        const selectedProjectsDiv = document.getElementById('selectedProjects');

        // Clear existing projects
        availableProjectsDiv.innerHTML = '';

        // Get selected projects from team data
        const selectedProjectIDs = teamData.selectedProjects || [];
        const selectedSet = new Set(selectedProjectIDs);

        if (projectsSnapshot.empty) {
            availableProjectsDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>لا توجد مشاريع متاحة حالياً</p>
                </div>
            `;
        } else {

            projectsSnapshot.forEach(docSnap => {
                const projectData = docSnap.data();
                const projectID = docSnap.id;

                // 🔥 فلترة حسب نوع الدراسة - تخطي إذا كان targetStudyType مختلفاً
                if (projectData.targetStudyType && projectData.targetStudyType !== studentStudyType) {
                    console.log(`❌ تم تخطي مشروع "${projectData.title}" - نوع الدراسة: ${projectData.targetStudyType}، نوع الطالب: ${studentStudyType}`);
                    return;
                }

                // إذا لم يكن لديه targetStudyType، لا نعرضه
                if (!projectData.targetStudyType) {
                    console.log(`⚠️ تم تخطي مشروع "${projectData.title}" - لم يتم تحديد نوع الدراسة المستهدف`);
                    return;
                }

                // Skip if already selected
                if (selectedSet.has(projectID)) {
                    return;
                }

                console.log(`✅ عرض مشروع "${projectData.title}" - نوع الدراسة: ${projectData.targetStudyType}`);

                const projectItem = document.createElement('div');
                projectItem.className = 'project-item';
                projectItem.setAttribute('data-id', projectID);
                projectItem.setAttribute('onclick', 'window.dashboardApp.selectAvailableProject(this)');
                projectItem.innerHTML = `
                    <div class="project-info">
                        <div class="project-title">${projectData.title || 'بدون عنوان'}</div>
                        <div class="project-desc">${projectData.description || 'لا يوجد وصف'}</div>
                        <div style="font-size:0.85em; color:#666; margin-top:5px;">
                            المشرف: ${projectData.supervisorName || 'غير محدد'}
                        </div>
                        <div style="font-size:0.8em; color:#999; margin-top:3px;">
                            📚 الفئة: ${projectData.targetStudyType}
                        </div>
                    </div>
                `;
                availableProjectsDiv.appendChild(projectItem);
            });
        }

        // Load selected projects
        if (selectedProjectIDs.length > 0) {
            selectedProjectsDiv.innerHTML = '';
            for (let i = 0; i < selectedProjectIDs.length; i++) {
                const projectID = selectedProjectIDs[i];
                const projectDoc = await getDoc(doc(db, "projects", projectID));

                if (projectDoc.exists()) {
                    const projectData = projectDoc.data();
                    const projectItem = document.createElement('div');
                    projectItem.className = 'project-item';
                    projectItem.setAttribute('data-id', projectID);
                    projectItem.setAttribute('onclick', 'window.dashboardApp.selectChosenProject(this)');
                    projectItem.innerHTML = `
                        <div class="project-info">
                            <div class="project-title">${projectData.title || 'بدون عنوان'}</div>
                            <div class="project-desc">${projectData.description || 'لا يوجد وصف'}</div>
                        </div>
                        <div class="project-priority">#${i + 1}</div>
                    `;
                    selectedProjectsDiv.appendChild(projectItem);
                }
            }
        }

        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        updateProjectButtons();
    } catch (error) {
        loadingDiv.style.display = 'none';
        throw error;
    }
}

export async function confirmSelection() {
    try {
        // التحقق من تفعيل عملية النشر
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};

        if (!settings.projectsPublished) {
            addNotification("عملية الاختيار لم تبدأ بعد - يرجى الانتظار", "warning", 3000);
            throw new Error("عملية الاختيار لم تبدأ بعد - يرجى الانتظار");
        }

        const user = auth.currentUser;
        if (!user) {
            addNotification("يجب تسجيل الدخول أولاً", "error", 3000);
            throw new Error("يجب تسجيل الدخول أولاً");
        }

        const studentDoc = await getDoc(doc(db, "students", user.uid));
        const studentData = studentDoc.data();

        if (!studentData.teamCode) {
            addNotification("يجب أن تكون في فريق أولاً", "error", 3000);
            throw new Error("يجب أن تكون في فريق أولاً");
        }

        const selectedProjects = document.querySelectorAll('#selectedProjects .project-item');
        const projectIDs = Array.from(selectedProjects).map(item => item.dataset.id);

        if (projectIDs.length === 0) {
            addNotification("يجب اختيار مشروع واحد على الأقل", "warning", 3000);
            throw new Error("يجب اختيار مشروع واحد على الأقل");
        }

        // Update team document
        await updateDoc(doc(db, "teams", studentData.teamCode), {
            selectedProjects: projectIDs,
            isLocked: true
        });

        addNotification("✅ تم حفظ اختيارك بنجاح!", "success", 5000);
        // Reload to show updated state
        await loadProjectsFromFirestore();
    } catch (error) {
        console.error("Error confirming selection:", error);
        addNotification("❌ حدث خطأ: " + error.message, "error", 5000);
    }
}

export function resetSelection() {
    if (confirm("هل أنت متأكد من إعادة تعيين جميع الاختيارات؟")) {
        const selectedProjectsDiv = document.getElementById('selectedProjects');
        const availableProjectsDiv = document.getElementById('availableProjects');

        // Move all selected back to available
        const selectedItems = Array.from(selectedProjectsDiv.querySelectorAll('.project-item'));
        selectedItems.forEach(item => {
            const badge = item.querySelector('.project-priority');
            if (badge) badge.remove();
            item.setAttribute('onclick', 'window.dashboardApp.selectAvailableProject(this)');
            item.classList.remove('selected');
            availableProjectsDiv.appendChild(item);
        });

        // Show empty state
        selectedProjectsDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>لم تقم باختيار أي مشروع بعد</p>
            </div>
        `;

        selectedChosenProject = null;
        updateProjectButtons();
    }
}

// ===========================================
// Team Creation Logic
// ===========================================

export async function loadCreateTeamPage() {
    // Reload settings to get latest values
    await loadGlobalSettings();

    const contentArea = document.querySelector('.content-area');
    const maxMembers = globalSettings.teamMembersCount;
    const maxAdditionalMembers = Math.max(0, maxMembers - 1); // -1 for the leader

    contentArea.innerHTML = `
        <div class="team-form-container">
            <h2>📋 إنشاء فريق جديد</h2>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-right: 4px solid var(--success);">
                <p style="margin: 0; color: #2e7d32; font-weight: 500;">👥 الحد الأقصى لأعضاء الفريق: <strong>${maxMembers}</strong> (أنت + ${maxAdditionalMembers} ${maxAdditionalMembers === 1 ? 'عضو آخر' : 'أعضاء آخرين'})</p>
            </div>
            <div class="form-card">
                <form id="create-team-form">
                    <div class="form-group">
                        <label>اسم الفريق:</label>
                        <input type="text" id="team-name" class="form-input" placeholder="أدخل اسم الفريق" required>
                    </div>
                    
                    <div class="form-group">
                        <label>قائد الفريق (أنت):</label>
                        <input type="text" id="leader-username" class="form-input" disabled style="background:#eee;">
                    </div>

                    <div class="form-group">
                        <label>أعضاء الفريق:</label>
                        <div id="membersContainer">
                            <!-- Members will be added here -->
                        </div>
                        <div style="margin-top: 10px; text-align: right;">
                            <span id="member-counter" style="font-weight: bold; color: var(--primary);">1 / ${maxMembers}</span>
                        </div>
                    </div>
                    
                    <button type="button" class="add-member-btn" id="add-member-btn" onclick="window.dashboardApp.teamAddMember()">
                        ➕ إضافة طالب آخر
                    </button>
                    
                    <button type="submit" class="submit-btn" id="register-team-btn">
                        ✅ تسجيل الفريق
                    </button>
                </form>
            </div>
            <div id="loading" style="display:none; text-align:center; padding:20px;">
                <div class="spinner" style="margin:0 auto;"></div>
                <p>جاري المعالجة...</p>
            </div>
            <div id="error-message" style="display:none; color:var(--warning); text-align:center; padding:15px; margin-top:15px; background:#fff3cd; border-radius:8px;"></div>
        </div>
    `;

    const user = auth.currentUser;
    if (user) {
        initCreateTeamLogic(user, maxMembers);
    } else {
        onAuthStateChanged(auth, (u) => {
            if (u) initCreateTeamLogic(u, maxMembers);
        });
    }
}

async function initCreateTeamLogic(user, maxMembers) {
    const maxAdditionalMembers = Math.max(0, maxMembers - 1); // -1 for the leader

    const docRef = doc(db, "students", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.teamCode) {
            alert("لديك فريق بالفعل!");
            return;
        }
        const leaderInput = document.getElementById('leader-username');
        if (leaderInput) {
            leaderInput.value = data.username;
            leaderInput.dataset.uid = user.uid;
        }
    }

    // Add initial member input
    const membersContainer = document.getElementById('membersContainer');
    if (membersContainer && membersContainer.children.length === 0) {
        const div = document.createElement('div');
        div.className = 'member-input-group';
        div.innerHTML = `
            <input type="text" class="form-input member-input" placeholder="اسم مستخدم الطالب 2">
            <button type="button" class="remove-btn" onclick="this.parentElement.remove(); updateMemberCounter();">✖</button>
        `;
        membersContainer.appendChild(div);
    }

    // Update member counter function
    window.updateMemberCounter = function () {
        const counter = document.getElementById('member-counter');
        if (counter) {
            const count = document.querySelectorAll('.member-input').length + 1; // +1 for leader
            counter.textContent = `${count} / ${maxMembers}`;
        }
    };

    // Update counter on input changes
    document.querySelectorAll('.member-input').forEach(input => {
        input.addEventListener('input', updateMemberCounter);
    });

    const form = document.getElementById('create-team-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const loadingDiv = document.getElementById('loading');
            const errorDiv = document.getElementById('error-message');
            errorDiv.style.display = 'none';
            loadingDiv.style.display = 'block';

            try {
                const teamName = document.getElementById('team-name').value.trim();
                const leaderUsername = document.getElementById('leader-username').value.trim();
                const leaderUID = user.uid;

                if (!teamName) {
                    throw new Error("يرجى إدخال اسم الفريق");
                }

                const inputs = document.querySelectorAll('.member-input');
                const memberUsernames = Array.from(inputs).map(i => i.value.trim()).filter(x => x);

                // Validate team size (dynamic max from settings)
                if (memberUsernames.length > maxAdditionalMembers) {
                    throw new Error(`الحد الأقصى ${maxAdditionalMembers} ${maxAdditionalMembers === 1 ? 'عضو إضافي' : 'أعضاء إضافيين'} + القائد (${maxMembers} إجمالي)`);
                }

                // Get leader data
                const leaderDoc = await getDoc(doc(db, "students", leaderUID));
                if (!leaderDoc.exists()) {
                    throw new Error("بيانات القائد غير موجودة");
                }
                const leaderData = leaderDoc.data();

                // Validate usernames
                const allUsernames = [leaderUsername, ...memberUsernames];
                const validationResult = await validateUsernames(allUsernames, leaderData);

                if (validationResult.invalidUsernames.length > 0) {
                    throw new Error(`أسماء المستخدمين التالية غير موجودة: ${validationResult.invalidUsernames.join(', ')}`);
                }

                if (validationResult.alreadyInTeam.length > 0) {
                    throw new Error(`الطلاب التالية لديهم فرق بالفعل: ${validationResult.alreadyInTeam.join(', ')}`);
                }

                if (!validationResult.allMatch) {
                    throw new Error("جميع الأعضاء يجب أن يكونوا من نفس الجامعة والكلية والقسم ونوع الدراسة");
                }

                // Generate team code
                const teamCode = generateTeamCode();

                // Calculate highest GPA
                const allGPAs = [leaderData.gpa || 0, ...validationResult.validUsers.map(u => u.gpa || 0)];
                const highestGPA = Math.max(...allGPAs);

                // Get all member UIDs
                const memberUIDs = validationResult.validUsers.map(u => u.uid);

                // Create team document
                await setDoc(doc(db, "teams", teamCode), {
                    teamName,
                    teamCode,
                    leaderUID,
                    leaderUsername,
                    memberUsernames: validationResult.validUsers.map(u => u.username),
                    memberUIDs: [leaderUID, ...memberUIDs],
                    highestGPA,
                    selectedProjects: [],
                    assignedProjectID: null,
                    isLocked: false,
                    createdAt: Timestamp.now()
                });

                // Update leader document
                await updateDoc(doc(db, "students", leaderUID), {
                    teamCode,
                    teamName,
                    isLeader: true
                });

                // Update member documents
                for (const memberUID of memberUIDs) {
                    await updateDoc(doc(db, "students", memberUID), {
                        teamCode,
                        teamName,
                        isLeader: false
                    });
                }

                loadingDiv.style.display = 'none';
                alert(`✅ تم إنشاء الفريق بنجاح!\n\nاسم الفريق: ${teamName}\nرمز الفريق: ${teamCode}\n\nاحفظ رمز الفريق للمشاركة مع أعضاء الفريق.`);
                window.dashboardApp.loadPage('view-team');
            } catch (err) {
                console.error(err);
                loadingDiv.style.display = 'none';
                errorDiv.textContent = err.message;
                errorDiv.style.display = 'block';
            }
        };
    }
}

// Validation function
async function validateUsernames(usernames, leaderData) {
    const validUsers = [];
    const invalidUsernames = [];
    const alreadyInTeam = [];

    // Query all usernames (Firestore 'in' query supports up to 10 items)
    if (usernames.length > 10) {
        throw new Error("عدد كبير جداً من أسماء المستخدمين");
    }

    const usersQuery = query(collection(db, "students"), where("username", "in", usernames));
    const snapshot = await getDocs(usersQuery);

    const foundUsernames = new Set();
    snapshot.forEach(docSnap => {
        const userData = docSnap.data();
        foundUsernames.add(userData.username);

        // Skip leader (already has teamCode check done separately)
        if (userData.username === leaderData.username) {
            return;
        }

        if (userData.teamCode) {
            alreadyInTeam.push(userData.username);
        } else {
            validUsers.push({ uid: docSnap.id, ...userData });
        }
    });

    // Check for invalid usernames
    usernames.forEach(username => {
        if (!foundUsernames.has(username)) {
            invalidUsernames.push(username);
        }
    });

    // Check if all from same university/college/department/study-type
    const allUsers = [leaderData, ...validUsers];
    const firstUser = leaderData;
    const allMatch = allUsers.every(u =>
        u.university === firstUser.university &&
        u.college === firstUser.college &&
        u.department === firstUser.department &&
        u.studyType === firstUser.studyType
    );

    return { validUsers, invalidUsernames, alreadyInTeam, allMatch };
}

// Generate 6-character alphanumeric team code
function generateTeamCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export function teamAddMember() {
    const container = document.getElementById('membersContainer');
    const maxMembers = globalSettings.teamMembersCount || 4;
    const maxAdditionalMembers = Math.max(0, maxMembers - 1); // -1 for leader

    if (container && container.children.length >= maxAdditionalMembers) {
        addNotification(`❌ تم الوصول للحد الأقصى من الأعضاء (${maxMembers})`, "error", 4000);
        return;
    }

    addNotification(`✅ تم إضافة حقل جديد`, "success", 2000);

    const div = document.createElement('div');
    div.className = 'member-input-group';
    div.innerHTML = `
        <input type="text" class="form-input member-input" placeholder="اسم مستخدم الطالب">
        <button type="button" class="remove-btn" onclick="this.parentElement.remove(); if(window.updateMemberCounter) window.updateMemberCounter();">✖</button>
    `;
    container.appendChild(div);

    // Add event listener for counter update
    const input = div.querySelector('.member-input');
    input.addEventListener('input', () => {
        if (window.updateMemberCounter) window.updateMemberCounter();
    });

    // Update counter
    if (window.updateMemberCounter) window.updateMemberCounter();
}

// ===========================================
// Team View Logic
// ===========================================

export async function loadViewTeamPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `<div class="loading-container"><div class="spinner"></div><h2>جاري التحميل...</h2></div>`;

    const user = auth.currentUser;
    if (!user) return;

    try {
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);

        if (!studentSnap.exists()) {
            contentArea.innerHTML = `<div class="error-message">❌ عذراً، بيانات الطالب غير متوفرة لهذا الحساب. (قد تكون مسجلاً كمشرف؟)</div>`;
            return;
        }

        const studentData = studentSnap.data();

        if (!studentData.teamCode) {
            contentArea.innerHTML = `
                <div class="empty-state">
                    <h3>ليس لديك فريق بعد</h3>
                    <button class="btn btn-primary" onclick="window.dashboardApp.loadPage('create-team')">إنشاء فريق</button>
                </div>
            `;
            return;
        }

        const teamRef = doc(db, "teams", studentData.teamCode);
        const teamSnap = await getDoc(teamRef);
        const teamData = teamSnap.data();

        // Format creation date
        const createdAt = teamData.createdAt?.toDate ? teamData.createdAt.toDate() : new Date();
        const formattedDate = createdAt.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Calculate member count
        const memberCount = 1 + (teamData.memberUsernames?.length || 0); // Leader + members

        contentArea.innerHTML = `
            <div class="view-teams-container">
                <div class="team-header">
                    <h1 class="team-name">${teamData.teamName || 'فريق بدون اسم'}</h1>
                    <div class="team-description">
                        <span style="background:var(--light); padding:8px 20px; border-radius:20px; font-family:monospace; font-size:1.3rem; font-weight:bold; color:var(--primary);">
                            ${teamData.teamCode}
                        </span>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:20px; margin-bottom:40px;">
                    <div class="card" style="text-align:center; padding:25px;">
                        <div style="font-size:2.5rem; margin-bottom:10px;">👥</div>
                        <h3 style="color:#666; margin-bottom:10px;">عدد الأعضاء</h3>
                        <h2 style="font-size:2.5rem; color:var(--primary); font-weight:bold;">${memberCount}</h2>
                    </div>
                    <div class="card" style="text-align:center; padding:25px;">
                        <div style="font-size:2.5rem; margin-bottom:10px;">📅</div>
                        <h3 style="color:#666; margin-bottom:10px;">تاريخ الإنشاء</h3>
                        <h2 style="font-size:1.3rem; color:var(--primary); font-weight:bold;">${formattedDate}</h2>
                    </div>
                    <div class="card" style="text-align:center; padding:25px;">
                        <div style="font-size:2.5rem; margin-bottom:10px;">${teamData.isLocked ? '🔒' : '🔓'}</div>
                        <h3 style="color:#666; margin-bottom:10px;">حالة القفل</h3>
                        <h2 style="font-size:1.5rem; color:${teamData.isLocked ? 'var(--warning)' : 'var(--success)'}; font-weight:bold;">
                            ${teamData.isLocked ? 'مقفل' : 'مفتوح'}
                        </h2>
                    </div>
                    <div class="card" style="text-align:center; padding:25px;">
                        <div style="font-size:2.5rem; margin-bottom:10px;">⭐</div>
                        <h3 style="color:#666; margin-bottom:10px;">أعلى معدل GPA</h3>
                        <h2 style="font-size:2.5rem; color:var(--primary); font-weight:bold;">${(teamData.highestGPA || 0).toFixed(2)}</h2>
                    </div>
                </div>

                <!-- Progress Section -->
                <div class="card" style="text-align:center; padding:25px; margin-bottom:40px;">
                    <h3 style="color:#666; margin-bottom:15px; font-size:1.5rem;">نسبة الإنجاز الكلي</h3>
                    <div style="background:#edf2f7; border-radius:15px; height:30px; width:100%; overflow:hidden; box-shadow:inset 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="background:${(teamData.totalProgress || 0) <= 30 ? '#e53e3e' : (teamData.totalProgress || 0) <= 70 ? '#dd6b20' : '#38a169'}; 
                                    height:100%; width:${teamData.totalProgress || 0}%; 
                                    transition:width 1s ease-in-out; 
                                    display:flex; align-items:center; justify-content:center; 
                                    color:white; font-weight:bold; font-size:1.1rem; text-shadow:0 1px 2px rgba(0,0,0,0.3);">
                            ${Math.round(teamData.totalProgress || 0)}%
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:0.9rem; color:#718096;">
                        <span>0% (بداية)</span>
                        <span>100% (اكتمال)</span>
                    </div>
                </div>

                <h3 style="text-align:center; margin-bottom:30px; font-size:1.8rem; color:var(--dark);">أعضاء الفريق</h3>
                <div class="team-members">
                    <div class="member-card admin">
                         <div class="member-avatar">${teamData.leaderUsername?.charAt(0).toUpperCase() || '?'}</div>
                         <div class="member-name">${teamData.leaderUsername || 'غير محدد'}</div>
                         <div class="role-badge admin">👑 قائد الفريق</div>
                    </div>
                    ${(teamData.memberUsernames || []).map(m => `
                        <div class="member-card">
                            <div class="member-avatar">${m.charAt(0).toUpperCase()}</div>
                            <div class="member-name">${m}</div>
                            <div class="role-badge member">👤 عضو</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

    } catch (err) {
        console.error(err);
        contentArea.innerHTML = `<div class="error-message">حدث خطأ في تحميل البيانات</div>`;
    }
}

// ===========================================
// Settings Logic
// ===========================================

export function loadSettingsPage(type = 'general') {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="settings-container">
            <div class="settings-sidebar">
                <div class="sidebar-header"><h3>⚙️ الإعدادات</h3></div>
                <div class="sidebar-menu">
                    <button class="settings-btn ${type === 'general' ? 'active' : ''}" onclick="window.dashboardApp.loadPage('settings-general')">عام</button>
                    <button class="settings-btn ${type === 'privacy' ? 'active' : ''}" onclick="window.dashboardApp.loadPage('settings-privacy')">الخصوصية</button>
                </div>
            </div>
            <div class="settings-content-area">
                ${type === 'general' ? `<h2>الإعدادات العامة</h2><p>خيارات اللغة والسمات...</p>` : ''}
                ${type === 'privacy' ? `<h2>الخصوصية والأمان</h2><p>تغيير كلمة المرور...</p>` : ''}
            </div>
        </div>
    `;
}

// ===========================================
// Tasks Logic
// ===========================================
export async function loadTasksPage(viewType = 'current') {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `<div class="loading-container"><div class="spinner"></div><h2>جاري تحميل المهام...</h2></div>`;

    const user = auth.currentUser;
    if (!user) return;

    try {
        // 1. Get Student Data to find Team Code
        const studentRef = doc(db, "students", user.uid);
        // 1. Get Student Data to find Team Code

        const studentSnap = await getDoc(studentRef);

        if (!studentSnap.exists()) {
            contentArea.innerHTML = `<div class="error-message">❌ عذراً، لم يتم العثور على ملف الطالب.</div>`;
            return;
        }

        const studentData = studentSnap.data();

        if (!studentData.teamCode) {
            contentArea.innerHTML = `
                <div class="empty-state">
                    <h3>❌ لست عضواً في أي فريق</h3>
                    <p>يجب أن تنضم إلى فريق أولاً لتلقي المهام.</p>
                </div>
            `;
            return;
        }

        // 2. Query Tasks for this Team
        const tasksRef = collection(db, "tasks");
        let q;

        if (viewType === 'current') {
            q = query(
                tasksRef,
                where("teamId", "==", studentData.teamCode),
                where("status", "in", ["pending", "submitted", "revision_requested"])
            );
        } else {
            q = query(
                tasksRef,
                where("teamId", "==", studentData.teamCode),
                where("status", "==", "completed")
            );
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            contentArea.innerHTML = `
                <div class="empty-state">
                    <h3>${viewType === 'current' ? '📭 لا توجد مهام حالية' : '✅ سجل المهام فارغ'}</h3>
                    <p>${viewType === 'current' ? 'لم يرسل المشرف أي مهام جديدة بعد.' : 'لم يتم إكمال أي مهام حتى الآن.'}</p>
                </div>
            `;
            return;
        }

        // 3. Render Tasks
        let html = `
            <div class="tasks-container">
                <div class="page-header">
                    <h2>${viewType === 'current' ? '📋 المهام الحالية' : '✅ المهام المنجزة'}</h2>
                </div>
                <div class="tasks-grid" style="display:grid; gap:20px;">
        `;

        querySnapshot.forEach(docSnap => {
            const task = docSnap.data();
            const taskId = docSnap.id;
            const isTheory = task.type === 'theory';
            const isRevision = task.status === 'revision_requested';

            html += `
                <div class="task-card" style="background:white; padding:20px; border-radius:12px; border-right: 5px solid ${isTheory ? '#4299e1' : '#48bb78'}; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <span class="badge" style="background:${isTheory ? '#ebf8ff' : '#f0fff4'}; color:${isTheory ? '#2b6cb0' : '#2f855a'}; padding:5px 12px; border-radius:15px; font-size:0.85rem;">
                            ${isTheory ? '📚 نظري' : '💻 عملي'}
                        </span>
                        <span style="color:#718096; font-size:0.9rem;">📅 تسليم: ${task.dueDate}</span>
                    </div>
                    
                    <h3 style="margin-bottom:10px; color:#2d3748;">${task.title}</h3>
                    <p style="color:#4a5568; line-height:1.6; margin-bottom:20px;">${task.description}</p>
                    
                    ${isRevision ? `
                        <div style="background:#fffaf0; border:1px solid #fbd38d; padding:15px; border-radius:8px; margin-bottom:20px; animation: pulse 2s infinite;">
                            <strong style="color:#c05621; display:flex; align-items:center;">
                                <span style="font-size:1.2em; margin-left:5px;">⚠️</span> 
                                طلب تعديل من المشرف
                            </strong>
                            <p style="margin-top:10px; color:#744210; background:rgba(255,255,255,0.5); padding:10px; border-radius:5px;">
                                "${task.feedback || "يرجى مراجعة ملاحظات المشرف وتعديل الحل."}"
                            </p>
                        </div>
                    ` : ''}

                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:15px;">
                        <span style="font-weight:bold; color:#2d3748;">⚖️ الوزن: ${task.weight} نقطة</span>
                        
                        ${task.status === 'pending' || isRevision ? `
                            <button onclick="window.dashboardApp.submitTask('${taskId}')" class="btn btn-primary" style="padding:10px 25px; ${isRevision ? 'background:#ed8936;' : ''}">
                                ${isRevision ? '🔄 إعادة رفع الحل' : '📤 تسليم المهمة'}
                            </button>
                        ` : task.status === 'submitted' ? `
                            <span style="color:#38a169; font-weight:bold; background:#f0fff4; padding:5px 10px; border-radius:5px;">✅ تم التسليم (بانتظار التقييم)</span>
                        ` : `
                            <span style="color:#2b6cb0; font-weight:bold;">🏅 تم التقييم</span>
                        `}
                    </div>
                    
                    ${task.submissionLink ? `
                        <div style="margin-top:10px; font-size:0.9rem;">
                            🔗 الرابط: <a href="${task.submissionLink}" target="_blank" style="color:blue;">${task.submissionLink}</a>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += `</div></div>`;

        // Add style for pulse animation
        if (!document.getElementById('revision-style')) {
            const style = document.createElement('style');
            style.id = 'revision-style';
            style.innerHTML = `
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(237, 137, 54, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(237, 137, 54, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(237, 137, 54, 0); }
                }
            `;
            document.head.appendChild(style);
        }

        contentArea.innerHTML = html;

    } catch (error) {
        console.error("Error loading tasks:", error);
        contentArea.innerHTML = `<p style="color:red; text-align:center;">حدث خطأ أثناء تحميل المهام: ${error.message}</p>`;
    }
}

export async function submitTask(taskId) {
    const link = await showPromptModal("تسليم المهمة", "أدخل رابط ملف الحل (google Drive, Github, etc):", "https://example.com/...");
    if (!link) return;

    try {
        const taskRef = doc(db, "tasks", taskId);
        await updateDoc(taskRef, {
            submissionLink: link,
            status: 'submitted',
            submittedAt: serverTimestamp(),
            feedback: null // Clear feedback on resubmit
        });
        showToast("✅ تم تسليم المهمة بنجاح!", 'success');
        loadTasksPage('current'); // Reload
    } catch (error) {
        console.error(error);
        showToast("❌ خطأ في التسليم: " + error.message, 'error');
    }
}

