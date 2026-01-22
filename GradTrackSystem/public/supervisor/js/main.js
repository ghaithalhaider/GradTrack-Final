import { auth, db } from '../../student/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initProjects, setCurrentUserId, loadNotificationsFromFirebase, setupNotificationListener, toggleNotifications, clearAllNotifications, removeNotificationExport, markNotificationAsRead } from './projects.js';

// HTML Template for Projects Management (Inlined to avoid Fetch/CORS issues)
const PROJECTS_PAGE_HTML = `
<!-- Projects Management Container -->
<div class="projects-management-container">
    <div class="page-header">
        <h2>📊 إدارة المشاريع</h2>
        <p>قم بإدارة مشاريع التخرج الخاصة بك</p>
    </div>

    <!-- Projects Section -->
    <div id="projectsSection" class="projects-section">

        <!-- Existing Projects List -->
        <div class="projects-list">
            <h3>📋 المشاريع المضافة</h3>
            <div id="projectsContainer">
                <div class="loading-state" style="text-align:center; padding:20px;">جاري التحميل...</div>
            </div>
        </div>

        <!-- Add New Project Button -->
        <!-- Calls global showProjectForm() from projects.js -->
        <button class="btn btn-add-project" onclick="showProjectForm()">
            ➕ إضافة مشروع جديد
        </button>

        <!-- Publish Projects Button -->
        <button class="btn btn-publish-all" onclick="publishAllProjects()" id="publishBtn"
            style="display: none; width:100%;">
            📤 حفظ المشاريع وإرسالها
        </button>
    </div>
</div>

<!-- Add Project Modal -->
<div id="addProjectModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>➕ إضافة مشروع جديد</h3>
            <!-- Calls global closeProjectModal() -->
            <button class="close-btn" onclick="closeProjectModal()">✖</button>
        </div>

        <!-- Calls global addProject(event) -->
        <form id="addProjectForm" onsubmit="addProject(event)">

            <div class="form-group">
                <label>رقم المشروع</label>
                <input type="text" id="projectNumber" readonly class="form-input" style="background:#eee;">
            </div>

            <div class="form-group">
                <label>عنوان المشروع *</label>
                <input type="text" id="projectTitle" class="form-input" placeholder="مثال: نظام إدارة المكتبات"
                    required>
            </div>

            <div class="form-group">
                <label>وصف المشروع *</label>
                <textarea id="projectDescription" class="form-input" rows="5"
                    placeholder="اكتب وصفاً تفصيلياً للمشروع..." required style="height:100px;"></textarea>
            </div>

            <div class="form-group">
                <label>موجه الى طلبة *</label>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" name="studyType" value="صباحية" required>
                        <span> صباحية</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="studyType" value="مسائية">
                        <span>مسائية</span>
                    </label>

                </div>
            </div>

            <div class="form-actions">
                <button type="submit" class="submit-btn" style="width:auto; padding:10px 30px;">💾 حفظ المشروع</button>
                <button type="button" class="btn btn-secondary" onclick="closeProjectModal()"
                    style="width:auto; padding:10px 20px;">❌ إلغاء</button>
            </div>
        </form>
    </div>
</div>
`;

// Controller for Supervisor Dashboard
window.supervisorApp = {
  currentUser: null,

  // Notifications
  toggleNotifications: toggleNotifications,
  clearAllNotifications: clearAllNotifications,
  removeNotification: removeNotificationExport,
  markNotificationAsRead: markNotificationAsRead,

  loadPage: async (pageName) => {
    console.log("Loading Supervisor page:", pageName);
    const contentArea = document.querySelector('.content-area');

    // Handle "Add Project" link click - map to projects management
    if (pageName === 'add-project') {
      pageName = 'projects-management';
    }

    switch (pageName) {
      case 'dashboard':
      case 'home':
        contentArea.innerHTML = `
                    <div class="welcome-message">
                         <div class="welcome-icon" style="font-size:3em; margin-bottom:10px;">👨‍🏫</div>
                        <h1>مرحباً بك في لوحة تحكم المشرف</h1>
                        <p>اختر أحد القوائم أعلاه لإدارة مشاريع الطلبة</p>
                    </div>
                `;
        break;

      case 'projects-management':
        // Check permission first
        try {
          const settingsDoc = await getDoc(doc(db, "settings", "general"));
          const settings = settingsDoc.exists() ? settingsDoc.data() : {};

          if (!settings.allowProjectUpload) {
            contentArea.innerHTML = `
              <div style="padding: 40px 20px; text-align: center;">
                <div style="background: white; border-radius: 15px; padding: 40px; max-width: 600px; margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,0.1);">
                  <div style="font-size: 4em; margin-bottom: 20px;">⏳</div>
                  <h2 style="color: #333; margin: 20px 0;">عملية الرفع لم تبدأ بعد</h2>
                  <p style="color: #666; font-size: 1.1em; line-height: 1.8;">
                    عذراً، لم يسمح المسؤول برفع المشاريع حالياً.<br>
                    يرجى انتظار إعلان الإدارة ببدء عملية رفع المشاريع.
                  </p>
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin-top: 30px; color: #666;">
                    <p style="margin: 0;">📌 سيتم إخطارك عندما تكون العملية جاهزة للبدء</p>
                  </div>
                </div>
              </div>
            `;
            break;
          }
        } catch (error) {
          console.error("Error checking settings:", error);
        }

        // Inject Inlined HTML
        contentArea.innerHTML = PROJECTS_PAGE_HTML;

        // Initialize Logic with Auth Check & Loader Handling
        const initProjectsLogic = async () => {
          const loader = document.getElementById('projectsLoading');

          if (window.supervisorApp.currentUser) {
            try {
              await initProjects(window.supervisorApp.currentUser);
            } catch (e) {
              console.error("Init Error", e);
            } finally {
              if (loader) loader.style.display = 'none';
            }
          } else {
            // Retry once after short delay if auth is initializing
            console.log("Waiting for auth...");
            setTimeout(async () => {
              if (window.supervisorApp.currentUser) {
                try {
                  await initProjects(window.supervisorApp.currentUser);
                } catch (e) {
                  console.error("Delayed Init Error", e);
                } finally {
                  if (loader) loader.style.display = 'none';
                }
              } else {
                console.error("No user logged in for projects init");
                alert("يرجى تسجيل الدخول للوصول إلى هذه الصفحة");
                if (loader) loader.innerHTML = '<p style="color:red">يرجى تسجيل الدخول</p>';
              }
            }, 1500);
          }
        };

        initProjectsLogic();
        break;

      case 'projects-current':
        contentArea.innerHTML = `
                    <div class="card">
                        <h2>🚀 المشاريع الحالية</h2>
                        <p>قائمة بجميع المشاريع الحالية (عملي ونظري)...</p>
                    </div>`;
        break;

      case 'add-task':
        contentArea.innerHTML = `
                    <div class="team-form-container">
                        <h2>📝 إضافة مهمة جديدة للطلاب</h2>
                        <div class="form-card">
                            <form id="add-task-form">
                                <div class="form-group">
                                    <label>عنوان المهمة</label>
                                    <input type="text" class="form-input" placeholder="عنوان المهمة" required>
                                </div>
                                <div class="form-group">
                                    <label>تاريخ التسليم</label>
                                    <input type="date" class="form-input" required>
                                </div>
                                <button type="submit" class="submit-btn">➕ تعيين المهمة</button>
                            </form>
                        </div>
                    </div>
                `;
        break;

      case 'tasks-current':
        contentArea.innerHTML = `<h2>📋 المهام الحالية</h2><p>قائمة المهام...</p>`;
        break;

      case 'tasks-completed':
        contentArea.innerHTML = `<h2>✅ المهام المنفذة</h2><p>الأرشيف...</p>`;
        break;

      default:
        // Fallback
        window.supervisorApp.loadPage('dashboard');
    }

    // Update active class if needed
    document.querySelectorAll('.dropdown-item').forEach(link => {
      // Optional: add visual active state logic
    });
  },

  logout: () => {
    auth.signOut().then(() => {
      window.location.href = '../loginn/supervisor-login.html';
    });
  }
};

window.toggleMenu = function (button) {
  const dropdown = button.nextElementSibling;
  const parent = button.parentElement;
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item !== parent) item.classList.remove('active');
  });
  parent.classList.toggle('active');
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-item')) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.supervisorApp.currentUser = user;
      // Set current user ID and load notifications
      setCurrentUserId(user.uid);
      loadNotificationsFromFirebase();
      setupNotificationListener();
    }
  });

  window.supervisorApp.loadPage('dashboard');
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', window.supervisorApp.logout);
});
