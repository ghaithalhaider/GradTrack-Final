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
        // Call the function from projects.js to load assigned students
        if (window.loadCurrentProjects) {
          window.loadCurrentProjects();
        } else {
          contentArea.innerHTML = `<div style="padding:20px; color:red;">❌ خطأ: الدالة غير موجودة</div>`;
        }
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

  loadMyTeamsForSelect: async () => {
    const select = document.getElementById('teamSelect');
    if (!select || !window.supervisorApp.currentUser) return;

    // Debug Logging
    const currentUid = window.supervisorApp.currentUser.uid;
    console.log("🔍 Loading teams for Supervisor UID:", currentUid);

    try {
      select.innerHTML = '<option value="">-- اختر الفريق --</option>';

      // Step 1: Get Projects for this Supervisor
      const projectsQuery = query(collection(db, "projects"), where("supervisorUID", "==", currentUid));
      const projectsSnap = await getDocs(projectsQuery);

      const projectIDs = [];
      const projectMap = {};

      projectsSnap.forEach(p => {
        const data = p.data();
        projectIDs.push(p.id);
        projectMap[p.id] = data.title || "مشروع";
      });

      console.log("📂 Found Projects:", projectsSnap.size);
      console.log("🔗 Found Project IDs:", projectIDs);

      // Step 2: Fetch Teams linked to these projects
      let teamsSnapStub = [];

      if (projectIDs.length > 0) {
        // Chunking for 'in' query limit (10)
        const chunks = [];
        for (let i = 0; i < projectIDs.length; i += 10) {
          chunks.push(projectIDs.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          // FIX: Search by 'assignedProjectID' (capital ID)
          const q = query(collection(db, "teams"), where("assignedProjectID", "in", chunk));
          const snap = await getDocs(q);
          snap.forEach(d => teamsSnapStub.push(d));
        }
      } else {
        console.log("⚠️ No projects found for this supervisor.");
      }

      console.log("👥 Total Teams Found:", teamsSnapStub.length);

      if (teamsSnapStub.length === 0) {
        select.innerHTML += '<option disabled>لا توجد فرق مرتبطة بمشاريعك</option>';

        // Auto-run migration/standardization if no teams found but projects exist
        if (projectIDs.length > 0) {
          console.log("🛠️ No teams found. Attempting to standardize data structure...");
          window.supervisorApp.standardizeTeams(); // Auto-call
        }
        return;
      }

      // Filter duplicates just in case
      const processedIds = new Set();

      teamsSnapStub.forEach(docSnap => {
        if (processedIds.has(docSnap.id)) return;
        processedIds.add(docSnap.id);

        const team = docSnap.data();
        // FIX: Use 'teamName'
        const teamName = team.teamName || team.name || 'فريق بدون اسم';
        const projectTitle = projectMap[team.assignedProjectID] || "مشروع";

        // FIX: Display format [Project Name] - [Team Name]
        select.innerHTML += `<option value="${docSnap.id}">[${projectTitle}] - [${teamName}]</option>`;
      });

    } catch (error) {
      console.error("❌ Error loading teams:", error);
      select.innerHTML = '<option disabled>خطأ في التحميل</option>';
    }
  },

  // 🛠️ Standardization & Proof Script
  standardizeTeams: async () => {
    console.log("🛡️ Starting Data Standardization Protocol (SOP)...");
    try {
      const q = query(collection(db, "teams"));
      const snap = await getDocs(q);
      let updatedCount = 0;

      await runTransaction(db, async (transaction) => {
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const ref = doc(db, "teams", docSnap.id);
          let updates = {};

          // 1. Map name -> teamName
          if (!data.teamName && data.name) {
            updates.teamName = data.name;
          }

          // 2. Map code -> teamCode
          if (!data.teamCode && data.code) {
            updates.teamCode = data.code;
          }

          // 3. Convert Dates to Timestamp
          if (typeof data.createdAt === 'string') {
            updates.createdAt = serverTimestamp();
          }

          // 4. Ensure assignedProjectID format
          if (data.assignedProjectId && !data.assignedProjectID) {
            updates.assignedProjectID = data.assignedProjectId;
          }

          if (Object.keys(updates).length > 0) {
            transaction.update(ref, updates);
            updatedCount++;
          }
        });
      });

      console.log(`✅ Standardization Complete. Updated ${updatedCount} documents.`);

      // PROOF: Fetch one random document to show structure
      if (!snap.empty) {
        const randomDoc = snap.docs[0];
        const freshSnap = await getDoc(doc(db, "teams", randomDoc.id));
        const freshData = freshSnap.data();

        console.log("🧾 PROOF OF DATA STRUCTURE (Sample Document):");
        console.log("--------------------------------------------------");
        console.log(`🆔 Doc ID: ${freshSnap.id}`);
        console.log(`📛 teamName: ${freshData.teamName} ${freshData.name ? '(Old name exists)' : '(Clean)'}`);
        console.log(`🔢 teamCode: ${freshData.teamCode} ${freshData.code ? '(Old code exists)' : '(Clean)'}`);
        console.log(`📅 createdAt:`, freshData.createdAt); // Should be object if Timestamp
        console.log(`🔗 assignedProjectID: ${freshData.assignedProjectID}`);
        console.log("--------------------------------------------------");
      }

      if (updatedCount > 0) {
        setTimeout(() => {
          if (window.supervisorApp.loadMyTeamsForSelect) window.supervisorApp.loadMyTeamsForSelect();
        }, 1000);
      }

    } catch (e) {
      console.error("Standardization Failed:", e);
    }
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
