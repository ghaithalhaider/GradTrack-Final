import { auth, db } from '../../student/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDoc, updateDoc, doc, collection, query, where, getDocs, setDoc, runTransaction, serverTimestamp, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initProjects, setCurrentUserId, loadNotificationsFromFirebase, setupNotificationListener, toggleNotifications, clearAllNotifications, removeNotificationExport, markNotificationAsRead } from './projects.js';

// HTML Template for Projects Management
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
            <button class="close-btn" onclick="closeProjectModal()">✖</button>
        </div>

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
                    <form id="add-task-form" onsubmit="window.supervisorApp.handleAddTask(event)">
                        
                        <div class="form-group">
                            <label>الفريق المستهدف</label>
                            <select id="teamSelect" class="form-input" required>
                                <option value="">جاري التحميل...</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>نوع المهمة</label>
                            <select id="taskType" class="form-input" required>
                                <option value="theory">📚 نظري</option>
                                <option value="practical">💻 عملي</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>عنوان المهمة</label>
                            <input type="text" id="taskTitle" class="form-input" placeholder="مثال: تحليل النظام" required>
                        </div>

                        <div class="form-group">
                            <label>وصف المهمة</label>
                            <textarea id="taskDesc" class="form-input" rows="4" placeholder="تفاصيل المطلوب..." required></textarea>
                        </div>

                        <div class="form-group">
                             <label>وزن المهمة (نقاط)</label>
                             <input type="number" id="taskWeight" class="form-input" min="1" max="50" placeholder="مثال: 15" required>
                        </div>

                        <div class="form-group">
                            <label>تاريخ التسليم</label>
                            <input type="date" id="taskDate" class="form-input" required>
                        </div>

                        <button type="submit" class="submit-btn" id="addTaskBtn">➕ إرسال المهمة</button>
                    </form>
                </div>
            </div>
        `;
        // Load teams with Auth Wait
        const runLoadTeams = () => {
          if (window.supervisorApp.currentUser) {
            if (window.supervisorApp.loadMyTeamsForSelect) window.supervisorApp.loadMyTeamsForSelect();
          } else {
            setTimeout(() => {
              if (window.supervisorApp.currentUser) {
                if (window.supervisorApp.loadMyTeamsForSelect) window.supervisorApp.loadMyTeamsForSelect();
              } else {
                const sel = document.getElementById('teamSelect');
                if (sel) sel.innerHTML = '<option value="">يرجى تسجيل الدخول...</option>';
              }
            }, 1500);
          }
        };
        runLoadTeams();
        break;

      case 'tasks-current':
        contentArea.innerHTML = `
            <div class="page-header">
                <h2>📋 متابعة المهام الحالية</h2>
            </div>
            <div id="tasks-container" style="display: grid; gap: 20px;">
                <div style="text-align: center; padding: 40px;">جاري تحميل المهام...</div>
            </div>
        `;

        const runLoadTasks = () => {
          if (window.supervisorApp.currentUser) {
            window.supervisorApp.loadCurrentTasks();
          } else {
            setTimeout(() => {
              if (window.supervisorApp.currentUser) {
                window.supervisorApp.loadCurrentTasks();
              } else {
                document.getElementById('tasks-container').innerHTML = '<p style="color:red; text-align:center;">يرجى تسجيل الدخول لعرض المهام</p>';
              }
            }, 1500);
          }
        };
        runLoadTasks();
        break;

      case 'tasks-completed':
        const runLoadCompleted = () => {
          if (window.supervisorApp.currentUser) {
            window.supervisorApp.loadCompletedTasks();
          } else {
            setTimeout(() => {
              if (window.supervisorApp.currentUser) window.supervisorApp.loadCompletedTasks();
              else contentArea.innerHTML = '<p style="color:red; text-align:center;">يرجى تسجيل الدخول</p>';
            }, 1500);
          }
        };
        runLoadCompleted();
        break;

      case 'teams-progress':
        const runLoadProgress = () => {
          if (window.supervisorApp.currentUser) {
            window.supervisorApp.loadTeamsProgressPage();
          } else {
            setTimeout(() => {
              if (window.supervisorApp.currentUser) window.supervisorApp.loadTeamsProgressPage();
              else contentArea.innerHTML = '<p style="color:red; text-align:center;">يرجى تسجيل الدخول</p>';
            }, 1500);
          }
        };
        runLoadProgress();
        break;

      default:
        window.supervisorApp.loadPage('dashboard');
    }

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

<<<<<<< Updated upstream
      // Step 1: Get Projects for this Supervisor
      const projectsQuery = query(collection(db, "projects"), where("supervisorUID", "==", currentUid));
      const projectsSnap = await getDocs(projectsQuery);
=======
      // Step 1: Get Projects (Try both field names)
      const pQuery1 = query(collection(db, "projects"), where("supervisorId", "==", currentUid));
      const pQuery2 = query(collection(db, "projects"), where("supervisorUID", "==", currentUid));

      const [snap1, snap2] = await Promise.all([getDocs(pQuery1), getDocs(pQuery2)]);
>>>>>>> Stashed changes

      const projectIDs = [];
      const projectMap = {};

<<<<<<< Updated upstream
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
=======
      const processSnap = (snap) => {
        snap.forEach(p => {
          const data = p.data();
          if (!projectMap[p.id]) { // Avoid duplicates
            projectIDs.push(p.id);
            projectMap[p.id] = data.title || "مشروع";
          }
        });
      };

      processSnap(snap1);
      processSnap(snap2);

      console.log("📂 Found Projects:", projectIDs.length);

      // Step 2: Fetch Teams
      let teamsSnapStub = [];

      if (projectIDs.length > 0) {
        // Chunk query
>>>>>>> Stashed changes
        const chunks = [];
        for (let i = 0; i < projectIDs.length; i += 10) {
          chunks.push(projectIDs.slice(i, i + 10));
        }

        for (const chunk of chunks) {
<<<<<<< Updated upstream
          // FIX: Search by 'assignedProjectID' (capital ID)
          const q = query(collection(db, "teams"), where("assignedProjectID", "in", chunk));
          const snap = await getDocs(q);
          snap.forEach(d => teamsSnapStub.push(d));
        }
      } else {
        console.log("⚠️ No projects found for this supervisor.");
=======
          // Query teams assigned to these projects (Check BOTH 'ID' and 'Id')
          const q1 = query(collection(db, "teams"), where("assignedProjectID", "in", chunk));
          const q2 = query(collection(db, "teams"), where("assignedProjectId", "in", chunk));

          const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

          snap1.forEach(d => teamsSnapStub.push(d));
          snap2.forEach(d => teamsSnapStub.push(d));
        }
      } else {
        console.warn("⚠️ No projects found for this supervisor (tried both 'supervisorId' and 'supervisorUID').");
        select.innerHTML = '<option disabled>لا توجد مشاريع مسندة إليك</option>';
        return;
>>>>>>> Stashed changes
      }

      console.log("👥 Total Teams Found:", teamsSnapStub.length);

      if (teamsSnapStub.length === 0) {
<<<<<<< Updated upstream
        select.innerHTML += '<option disabled>لا توجد فرق مرتبطة بمشاريعك</option>';

        // Auto-run migration/standardization if no teams found but projects exist
        if (projectIDs.length > 0) {
          console.log("🛠️ No teams found. Attempting to standardize data structure...");
          window.supervisorApp.standardizeTeams(); // Auto-call
        }
=======
        select.innerHTML = `<option disabled>وجدت ${projectIDs.length} مشاريع، ولكن لا توجد فرق مسندة لها</option>`;
>>>>>>> Stashed changes
        return;
      }

      // Filter duplicates just in case
      const processedIds = new Set();

      teamsSnapStub.forEach(docSnap => {
        if (processedIds.has(docSnap.id)) return;
        processedIds.add(docSnap.id);

        const team = docSnap.data();
<<<<<<< Updated upstream
        // FIX: Use 'teamName'
        const teamName = team.teamName || team.name || 'فريق بدون اسم';
        const projectTitle = projectMap[team.assignedProjectID] || "مشروع";

        // FIX: Display format [Project Name] - [Team Name]
        select.innerHTML += `<option value="${docSnap.id}">[${projectTitle}] - [${teamName}]</option>`;
=======
        const teamName = team.teamName || team.name || 'فريق بدون اسم';
        // Handle both casing for lookup
        const pId = team.assignedProjectID || team.assignedProjectId;
        const projectTitle = projectMap[pId] || "مشروع";

        // Use teamCode as value as requested
        select.innerHTML += `<option value="${team.teamCode || docSnap.id}">[${projectTitle}] - [${teamName}]</option>`;
>>>>>>> Stashed changes
      });

    } catch (error) {
      console.error("❌ Error loading teams:", error);
      select.innerHTML = '<option disabled>خطأ في التحميل</option>';
    }
  },

<<<<<<< Updated upstream
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
=======
  handleAddTask: async (e) => {
    e.preventDefault();
    const btn = document.getElementById('addTaskBtn');
    btn.innerText = 'جاري الإرسال...';
    btn.disabled = true;

    try {
      const teamCode = document.getElementById('teamSelect').value;
      if (!teamCode) throw new Error("يرجى اختيار فريق");

      const data = {
        teamId: teamCode,
        type: document.getElementById('taskType').value,
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDesc').value,
        weight: parseInt(document.getElementById('taskWeight').value),
        dueDate: document.getElementById('taskDate').value,
        supervisorUID: window.supervisorApp.currentUser.uid,
        status: 'pending', // pending -> submitted -> completed
        createdAt: serverTimestamp(),
        submissionLink: null
      };

      await setDoc(doc(collection(db, "tasks")), data);
      alert("✅ تم إرسال المهمة بنجاح!");
      document.getElementById('add-task-form').reset();

    } catch (error) {
      console.error(error);
      alert("❌ خطأ: " + error.message);
    } finally {
      btn.innerText = '➕ إرسال المهمة';
      btn.disabled = false;
    }
  },

  loadCurrentTasks: async () => {
    const container = document.getElementById('tasks-container');
    const uid = window.supervisorApp.currentUser.uid;

    try {
      // Get tasks for this supervisor that are NOT completed
      const q = query(
        collection(db, "tasks"),
        where("supervisorUID", "==", uid),
        where("status", "in", ["pending", "submitted", "revision_requested"])
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        container.innerHTML = `<div class="empty-state" style="text-align:center; padding:40px; background:white; border-radius:10px;">لا توجد مهام جارية حالياً</div>`;
        return;
      }

      let html = '';

      snap.forEach(docSnap => {
        const task = docSnap.data();
        const isSubmitted = task.status === 'submitted';

        html += `
                <div class="task-card" style="background: white; padding: 20px; border-radius: 12px; border-left: 5px solid ${task.type === 'theory' ? '#4299e1' : '#48bb78'}; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <span style="background: ${task.type === 'theory' ? '#ebf8ff' : '#f0fff4'}; color: ${task.type === 'theory' ? '#2b6cb0' : '#2f855a'}; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; font-weight: bold;">
                                ${task.type === 'theory' ? '📚 نظري' : '💻 عملي'}
                            </span>
                            <h3 style="margin: 10px 0;">${task.title}</h3>
                            <p style="color: #666; font-size: 0.9em; margin-bottom: 15px;">${task.description}</p>
                            
                            ${isSubmitted ? `
                                <div style="background: #f0fff4; padding: 10px; border-radius: 8px; margin-top: 10px; border: 1px solid #c6f6d5;">
                                    <strong>✅ تم تسليم الحل:</strong><br>
                                    <a href="${task.submissionLink}" target="_blank" style="color: #2f855a; text-decoration: underline;">${task.submissionLink}</a>
                                </div>
                            ` : `<div style="color: #a0aec0; font-size: 0.9em;">⏳ بانتظار تسليم الطلاب...</div>`}
                        </div>
                        
                        <div style="text-align: left; min-width: 150px;">
                            <div style="font-weight: bold; font-size: 1.1em; color: #2d3748;">${task.weight} نقطة</div>
                            <div style="font-size: 0.85em; color: #718096; margin-bottom: 15px;">آخر موعد: ${task.dueDate}</div>
                            
                            ${isSubmitted ? `
                                <div style="display:flex; gap:5px; flex-direction:column;">
                                    <button onclick="window.supervisorApp.acceptTask('${docSnap.id}', '${task.teamId}', '${task.type}', ${task.weight})" 
                                        class="btn" style="background: #48bb78; color: white; width: 100%; padding: 8px;">
                                        ✅ قبول وتقييم
                                    </button>
                                    <button onclick="window.supervisorApp.requestRevision('${docSnap.id}')" 
                                        class="btn" style="background: #dd6b20; color: white; width: 100%; padding: 8px;">
                                        ⚠️ طلب تعديل
                                    </button>
                                </div>
                            ` : task.status === 'revision_requested' ? `
                                <div style="color:#dd6b20; font-weight:bold;">⚠️ بانتظار التعديل...</div>
                            ` : ''}
                        </div>
                    </div>
                </div>
              `;
      });

      container.innerHTML = html;

    } catch (e) {
      console.error(e);
      container.innerHTML = `<p style="color:red">خطأ في تحميل المهام</p>`;
    }
  },

  loadCompletedTasks: async () => {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="page-header"><h2>✅ المهام المنجزة (الأرشيف)</h2></div>
        <div id="completed-tasks-container" style="display:grid; gap:20px;">
             <div style="text-align:center;">جاري التحميل...</div>
        </div>
    `;

    const uid = window.supervisorApp.currentUser.uid;
    const container = document.getElementById('completed-tasks-container');

    try {
      const q = query(
        collection(db, "tasks"),
        where("supervisorUID", "==", uid),
        where("status", "==", "completed")
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        container.innerHTML = `<div class="empty-state">لا يوجد مهام مكتملة بعد</div>`;
        return;
      }

      let html = '';
      snap.forEach(d => {
        const task = d.data();
        html += `
                <div class="task-card" style="background:#f0fff4; padding:20px; border-radius:12px; border-right:5px solid #48bb78; opacity:0.8;">
                   <h3 style="color:#2f855a; text-decoration:line-through;">${task.title}</h3>
                   <p>${task.description}</p>
                   <div style="margin-top:10px; font-weight:bold;">الدرجة: ${task.weight}</div>
                   ${task.submissionLink ? `<a href="${task.submissionLink}" target="_blank">رابط الحل المؤرشف</a>` : ''}
                </div>
            `;
      });
      container.innerHTML = html;

    } catch (e) {
      console.error(e);
      container.innerHTML = "خطأ في التحميل";
    }
  },

  requestRevision: async (taskId) => {
    const feedback = prompt("اكتب ملاحظات التعديل للطالب:");
    if (!feedback) return;

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: 'revision_requested',
        feedback: feedback
      });
      alert("⚠️ تم إرسال طلب التعديل للطالب");
      window.supervisorApp.loadCurrentTasks();
    } catch (e) {
      console.error(e);
      alert("حدث خطأ: " + e.message);
    }
  },

  acceptTask: async (taskId, teamCode, type, weight) => {
    if (!confirm(`هل أنت متأكد من قبول هذه المهمة وإضافة ${weight} نقطة للفريق؟`)) return;

    try {
      // 1. Resolve Team Doc by teamCode (since ID != code potentially)
      const q = query(collection(db, "teams"), where("teamCode", "==", teamCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error(`Team with code ${teamCode} not found`);
      }

      const teamDocRef = snap.docs[0].ref;

      await runTransaction(db, async (transaction) => {
        const teamDoc = await transaction.get(teamDocRef);
        if (!teamDoc.exists()) throw new Error("Team doc vanished");

        const data = teamDoc.data();
        let currentTheory = data.theoryProgress || 0;
        let currentPractical = data.practicalProgress || 0;

        if (type === 'theory') {
          currentTheory = Math.min(50, currentTheory + weight); // Cap at 50
        } else {
          currentPractical = Math.min(50, currentPractical + weight); // Cap at 50
        }

        const newTotal = currentTheory + currentPractical;

        // Update Team with progress
        transaction.update(teamDocRef, {
          theoryProgress: currentTheory,
          practicalProgress: currentPractical,
          totalProgress: newTotal
        });

        // Update Task Status
        const taskRef = doc(db, "tasks", taskId);
        transaction.update(taskRef, {
          status: 'completed', // Auto-archive logic
          completedAt: serverTimestamp()
        });
      });

      alert("✅ تم قبول المهمة، وتحديث تقدم الفريق (Total: " + (await getDoc(teamDocRef)).data().totalProgress + "% )");
      window.supervisorApp.loadCurrentTasks(); // Reload (Task should vanish)

    } catch (e) {
      console.error(e);
      alert("❌ حدث خطأ: " + e.message);
    }
  },

  loadTeamsProgressPage: async () => {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
            <div class="page-header"><h2>📊 إحصائيات الفرق (تقدم الإنجاز)</h2></div>
            <div id="teams-stats-container">
                 <div style="text-align:center;">جاري جلب البيانات...</div>
            </div>
        `;

    const uid = window.supervisorApp.currentUser.uid;

    try {
      // 1. Get Supervisor Projects
      const projectsQ = query(collection(db, "projects"), where("supervisorUID", "==", uid));
      const projectsSnap = await getDocs(projectsQ);
      const projectIDs = projectsSnap.docs.map(d => d.id); // Default ID
      const projectIds = projectsSnap.docs.map(d => d.data().projectId); // Custom ID

      // Merge IDs and filter out undefined/null/empty strings aggressively
      const allProjIds = [...new Set([...projectIDs, ...projectIds])]
        .filter(id => id !== undefined && id !== null && id !== '');

      console.log("DEBUG: allProjIds for progress query:", allProjIds);

      if (allProjIds.length === 0) {
        document.getElementById('teams-stats-container').innerHTML = `<div class="empty-state">لا توجد مشاريع مسندة إليك</div>`;
        return;
      }

      // 2. Fetch Teams (Chunked)
      let teamsSnapStub = [];
      const chunks = [];
      for (let i = 0; i < allProjIds.length; i += 10) {
        chunks.push(allProjIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        if (!chunk || chunk.length === 0) continue;

        try {
          const q1 = query(collection(db, "teams"), where("assignedProjectID", "in", chunk));
          const q2 = query(collection(db, "teams"), where("assignedProjectId", "in", chunk));
          const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
          snap1.forEach(d => teamsSnapStub.push(d));
          snap2.forEach(d => teamsSnapStub.push(d));
        } catch (err) {
          console.warn("Error querying team chunk:", err);
        }
      }

      // Deduplicate
      const uniqueTeams = new Map();
      teamsSnapStub.forEach(d => uniqueTeams.set(d.id, d.data()));

      if (uniqueTeams.size === 0) {
        document.getElementById('teams-stats-container').innerHTML = `<div class="empty-state">لا توجد فرق مرتبطة بمشاريعك</div>`;
        return;
      }

      // 3. Render Table
      let html = `
                <table style="width:100%; border-collapse:collapse; background:white; border-radius:10px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                    <thead style="background:var(--primary); color:white;">
                        <tr>
                            <th style="padding:15px;">الفريق</th>
                            <th style="padding:15px;">نظري (50)</th>
                            <th style="padding:15px;">عملي (50)</th>
                            <th style="padding:15px;">المجموع (100)</th>
                            <th style="padding:15px;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

      uniqueTeams.forEach((team, id) => {
        const total = team.totalProgress || 0;
        let color = '#e53e3e'; // Red
        let label = 'متأخر';

        if (total > 30 && total <= 70) {
          color = '#dd6b20'; // Orange
          label = 'جاري العمل';
        } else if (total > 70) {
          color = '#38a169'; // Green
          label = 'ممتاز';
        }

        html += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:15px; font-weight:bold;">${team.teamName || 'فريق بدون اسم'}<br><small style="color:#777;">${team.teamCode}</small></td>
                        <td style="padding:15px; text-align:center;">${team.theoryProgress || 0}</td>
                        <td style="padding:15px; text-align:center;">${team.practicalProgress || 0}</td>
                        <td style="padding:15px; text-align:center;">
                            <div style="background:#edf2f7; border-radius:10px; height:20px; width:100px; margin:0 auto; overflow:hidden;">
                                <div style="width:${total}%; background:${color}; height:100%;"></div>
                            </div>
                            <span style="font-size:0.9em; font-weight:bold; color:${color};">${total}%</span>
                        </td>
                        <td style="padding:15px; text-align:center;">
                            <span style="background:${color}22; color:${color}; padding:4px 10px; border-radius:15px; font-size:0.85em;">${label}</span>
                        </td>
                    </tr>
                `;
      });

      html += `</tbody></table>`;
      document.getElementById('teams-stats-container').innerHTML = html;

    } catch (e) {
      console.error(e);
      document.getElementById('teams-stats-container').innerHTML = "خطأ في جلب البيانات";
>>>>>>> Stashed changes
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
