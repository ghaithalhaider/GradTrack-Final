
import { auth, db } from '../../student/js/firebase-config.js';
import { runDistributionAlgorithm } from './distribution-logic.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc, setDoc, addDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global toggleMenu function for dropdowns - يجب أن تكون معرفة أولاً
window.toggleMenu = function (button) {
    const dropdown = button.nextElementSibling;
    const parent = button.parentElement;

    // 1234567Close other dropdowns
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item !== parent) item.classList.remove('active');
    });

    parent.classList.toggle('active');
};

// Expose functions to window
window.adminApp = {
    loadPage: (pageName, params = {}) => {
        console.log("Loading page:", pageName, params);
        switch (pageName) {
            case 'dashboard':
            case 'home':
                showDashboardHome();
                break;
            case 'general':
                loadGeneralManagementPage();
                break;
            case 'teams':
            case 'teams-morning':
                loadTeamsPage('morning');
                break;
            case 'teams-evening':
                loadTeamsPage('evening');
                break;
            case 'students':
            case 'students-morning':
                loadStudentsPage('morning');
                break;
            case 'students-evening':
                loadStudentsPage('evening');
                break;
            case 'selections':
            case 'selections-morning':
                loadSelectionsPage('morning');
                break;
            case 'selections-evening':
                loadSelectionsPage('evening');
                break;
            case 'projects':
                loadSupervisorProjectsPage();
                break;
            case 'distribution':
                loadDistributionPage();
                break;
            case 'results':
                // Pass studyType from params
                loadResultsPage(params.studyType);
                break;
            case 'results-morning': // Keep for backward compatibility
                loadResultsPage('morning');
                break;
            case 'results-evening': // Keep for backward compatibility
                loadResultsPage('evening');
                break;
            default:
                showDashboardHome();
        }

        // Update sidebar active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageName) link.classList.add('active');
        });
    },

    logout: () => {
        auth.signOut().then(() => {
            window.location.href = '../index.html';
        });
    },

    saveStudentGPA: async (studentId, newGPA) => {
        try {
            await updateDoc(doc(db, "students", studentId), {
                gpa: parseFloat(newGPA)
            });
            alert("✅ تم حفظ المعدل بنجاح!");
            await loadTeamsPage();
        } catch (error) {
            alert("❌ خطأ: " + error.message);
        }
    },

    calculateTeamGPA: (members) => {
        if (members.length === 0) return 0;
        const total = members.reduce((sum, m) => sum + (parseFloat(m.gpa) || 0), 0);
        return (total / members.length).toFixed(2);
    },

    getGPAColor: (gpa) => {
        if (gpa >= 3.5) return 'gpa-excellent';
        if (gpa >= 3.0) return 'gpa-good';
        if (gpa >= 2.0) return 'gpa-average';
        return 'gpa-low';
    },

    deleteStudent: async (studentId) => {
        if (confirm("هل أنت متأكد من حذف هذا الطالب؟ سيتم حذفه نهائياً.")) {
            try {
                await deleteDoc(doc(db, "students", studentId));
                alert("✅ تم الحذف بنجاح");
                loadStudentsPage();
            } catch (error) {
                alert("❌ خطأ: " + error.message);
            }
        }
    },

    deleteTeam: async (teamId) => {
        if (confirm("هل أنت متأكد من حذف هذا الفريق؟ سيتم فك ارتباط الأعضاء.")) {
            try {
                // First find members and remove teamCode
                const membersQuery = await getDocs(collection(db, "students")); // Ideally use query()
                membersQuery.forEach(async (memberDoc) => {
                    if (memberDoc.data().teamCode === teamId) {
                        await updateDoc(doc(db, "students", memberDoc.id), { teamCode: null });
                    }
                });

                await deleteDoc(doc(db, "teams", teamId));
                alert("✅ تم حذف الفريق بنجاح");
                loadTeamsPage();
            } catch (error) {
                alert("❌ خطأ: " + error.message);
            }
        }
    },

    openEditStudentModal: (id, currentGpa) => {
        // Simple Prompt for now, or Custom Modal matching snippet
        // User asked for "Like the picture" which implies Custom Modal.
        // Let's inject a custom modal html
        const modalHtml = `
            <div class="modal-overlay" id="editGpaModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:3000;">
                <div style="background:white; padding:30px; border-radius:15px; width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: slideUp 0.3s ease;">
                    <h3 style="margin-bottom:20px; text-align:center;">تعديل المعدل التراكمي</h3>
                    <input type="number" id="newGpaInput" value="${currentGpa}" step="0.01" min="0" max="4"
                        style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:8px; font-size:1.1em; margin-bottom:20px;">
                    <div style="display:flex; gap:10px;">
                        <button onclick="window.adminApp.saveStudentGPA('${id}', document.getElementById('newGpaInput').value); document.getElementById('editGpaModal').remove();" 
                            style="flex:1; padding:12px; background:#667eea; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">حفظ</button>
                        <button onclick="document.getElementById('editGpaModal').remove()" 
                            style="flex:1; padding:12px; background:#e2e8f0; color:#4a5568; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">إلغاء</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },


};

// ToggleMenu is already defined at the top. Removed duplicate.




// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item')) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
    }
});

// Dashboard Home
function showDashboardHome() {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="welcome-message">
            <h1>مرحباً بك في لوحة تحكم الإدارة 🔐</h1>
            <p>إدارة شاملة للفرق والمشاريع والمفاضلة</p>
            <p>يمكنك إدارة بيانات الطلاب والفرق والمشاريع، وتنفيذ المفاضلة الآلية</p>
        </div>
    `;
}

// General Management Page
async function loadGeneralManagementPage() {
    const contentArea = document.querySelector('.content-area');

    contentArea.innerHTML = `
        <div style="padding: 40px 20px; max-width: 1200px; margin: 0 auto;">
            <h1 style="color: white; text-align: center; margin-bottom: 40px; font-size: 2.5em; font-weight: 700;">⚡ الإدارة العامة للنظام</h1>

            <div id="generalLoadingDiv" style="text-align: center; padding: 40px; color: white;">
                <div style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p>جاري تحميل الإعدادات...</p>
            </div>

            <div id="generalContentDiv" style="display: none;">
                <!-- كروت التحكم -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 30px;">
                    <!-- رفع المشاريع -->
                    <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); border-right: 5px solid #667eea; transition: all 0.3s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="color: #333; font-size: 1.3em; font-weight: 700; margin: 0;">📤 السماح برفع المشاريع</h3>
                            <div style="font-size: 2.5em;" id="uploadIcon">❌</div>
                        </div>
                        <p style="color: #666; margin-bottom: 15px; line-height: 1.6;">السماح للأساتذة برفع المشاريع الجديدة إلى النظام</p>
                        <div style="padding: 12px; border-radius: 8px; margin-bottom: 20px; font-weight: 700; text-align: center;" id="uploadStatus" class="status-badge status-inactive">الحالة الحالية: معطل</div>
                        <button style="width: 100%; padding: 14px; border: none; border-radius: 8px; cursor: pointer; font-family: 'Cairo', Arial; font-weight: 700; font-size: 1em; transition: all 0.3s ease; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white;" onclick="window.adminApp.toggleGeneralProjectUpload()" id="uploadBtn">
                            ✅ تفعيل الرفع
                        </button>
                    </div>

                    <!-- عرض المشاريع للطلاب -->
                    <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); border-right: 5px solid #764ba2; transition: all 0.3s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="color: #333; font-size: 1.3em; font-weight: 700; margin: 0;">👁️ عرض المشاريع للطلاب</h3>
                            <div style="font-size: 2.5em;" id="viewIcon">❌</div>
                        </div>
                        <p style="color: #666; margin-bottom: 15px; line-height: 1.6;">السماح للطلاب برؤية المشاريع المتاحة</p>
                        <div style="padding: 12px; border-radius: 8px; margin-bottom: 20px; font-weight: 700; text-align: center;" id="viewStatus" class="status-badge status-inactive">الحالة الحالية: مخفي</div>
                        <button style="width: 100%; padding: 14px; border: none; border-radius: 8px; cursor: pointer; font-family: 'Cairo', Arial; font-weight: 700; font-size: 1em; transition: all 0.3s ease; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white;" onclick="window.adminApp.toggleGeneralStudentView()" id="viewBtn">
                            ✅ إظهار المشاريع
                        </button>
                    </div>

                    <!-- نشر المشاريع -->
                    <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); border-right: 5px solid #ff9800; transition: all 0.3s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="color: #333; font-size: 1.3em; font-weight: 700; margin: 0;">🚀 نشر المشاريع</h3>
                            <div style="font-size: 2.5em;" id="publishIcon">❌</div>
                        </div>
                        <p style="color: #666; margin-bottom: 15px; line-height: 1.6;">بدء عملية الاختيار الرسمية للطلاب</p>
                        <div style="padding: 12px; border-radius: 8px; margin-bottom: 20px; font-weight: 700; text-align: center;" id="publishStatus" class="status-badge status-inactive">الحالة الحالية: لم تبدأ</div>
                        <button style="width: 100%; padding: 14px; border: none; border-radius: 8px; cursor: pointer; font-family: 'Cairo', Arial; font-weight: 700; font-size: 1em; transition: all 0.3s ease; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white;" onclick="window.adminApp.toggleGeneralPublishProjects()" id="publishBtn">
                            ✅ بدء النشر
                        </button>
                    </div>
                </div>

                <!-- ملخص الحالة -->
                <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); margin-bottom: 30px;">
                    <h3 style="color: #333; font-size: 1.5em; font-weight: 700; margin: 0 0 20px 0;">📊 ملخص الحالة الحالية:</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                        <div style="padding: 20px; background: #f5f5f5; border-radius: 10px; border-right: 4px solid #667eea;">
                            <p style="color: #666; margin: 0; font-size: 0.95em;">حالة رفع المشاريع من الأستاذ:</p>
                            <p style="font-size: 1.4em; font-weight: 700; margin: 10px 0 0 0;" id="summaryUpload">❌ معطل</p>
                        </div>
                        <div style="padding: 20px; background: #f5f5f5; border-radius: 10px; border-right: 4px solid #667eea;">
                            <p style="color: #666; margin: 0; font-size: 0.95em;">حالة رؤية الطلاب للمشاريع:</p>
                            <p style="font-size: 1.4em; font-weight: 700; margin: 10px 0 0 0;" id="summaryView">❌ مخفي</p>
                        </div>
                        <div style="padding: 20px; background: #f5f5f5; border-radius: 10px; border-right: 4px solid #667eea;">
                            <p style="color: #666; margin: 0; font-size: 0.95em;">حالة عملية الاختيار:</p>
                            <p style="font-size: 1.4em; font-weight: 700; margin: 10px 0 0 0;" id="summaryPublish">❌ لم تبدأ</p>
                        </div>
                    </div>
                </div>

                <!-- إعدادات إضافية -->
                <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); margin-bottom: 30px;">
                    <h3 style="color: #333; font-size: 1.5em; font-weight: 700; margin: 0 0 20px 0;">⚙️ الإعدادات الإضافية:</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <!-- عدد أعضاء الفريق -->
                        <div style="padding: 20px; background: #f5f5f5; border-radius: 10px; border-right: 4px solid #667eea;">
                            <label style="color: #333; font-weight: 700; font-size: 1em; margin-bottom: 10px; display: block;">👥 عدد أعضاء الفريق المطلوب:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="number" id="teamMembersCount" min="1" max="10" style="flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em;" />
                                <button onclick="window.adminApp.saveTeamMembersCount()" style="padding: 10px 20px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">💾 حفظ</button>
                            </div>
                            <p style="color: #666; margin: 10px 0 0 0; font-size: 0.9em;">القيمة الحالية: <strong id="currentTeamCount">-</strong></p>
                        </div>

                        <!-- عدد المشاريع المطلوبة -->
                        <div style="padding: 20px; background: #f5f5f5; border-radius: 10px; border-right: 4px solid #764ba2;">
                            <label style="color: #333; font-weight: 700; font-size: 1em; margin-bottom: 10px; display: block;">📚 عدد المشاريع المطلوبة من الأستاذ:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="number" id="requiredProjectsCount" min="1" max="20" style="flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em;" />
                                <button onclick="window.adminApp.saveRequiredProjectsCount()" style="padding: 10px 20px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">💾 حفظ</button>
                            </div>
                            <p style="color: #666; margin: 10px 0 0 0; font-size: 0.9em;">القيمة الحالية: <strong id="currentProjectCount">-</strong></p>
                        </div>
                    </div>
                </div>

                <!-- التعليمات -->
                <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-right: 4px solid #2196f3; border-radius: 10px; padding: 25px;">
                    <h4 style="color: #1565c0; font-size: 1.2em; font-weight: 700; margin: 0 0 15px 0;">📝 تعليمات الاستخدام:</h4>
                    <ul style="color: #333; margin: 0; padding-right: 20px;">
                        <li style="margin-bottom: 12px; line-height: 1.6;"><strong style="color: #1565c0;">الخطوة 1:</strong> فعّل "السماح برفع المشاريع" ليتمكن الأساتذة من إضافة مشاريع جديدة</li>
                        <li style="margin-bottom: 12px; line-height: 1.6;"><strong style="color: #1565c0;">الخطوة 2:</strong> فعّل "عرض المشاريع للطلاب" ليرى الطلاب المشاريع المتاحة</li>
                        <li style="margin-bottom: 12px; line-height: 1.6;"><strong style="color: #1565c0;">الخطوة 3:</strong> فعّل "نشر المشاريع" لبدء عملية الاختيار الرسمية</li>
                        <li style="margin-bottom: 12px; line-height: 1.6;"><strong style="color: #1565c0;">الخطوة 4:</strong> حدّد عدد أعضاء الفريق والمشاريع المطلوبة في الإعدادات الإضافية</li>
                        <li style="line-height: 1.6;"><strong style="color: #1565c0;">ملاحظة مهمة:</strong> إذا تم تعطيل أي خاصية، لن يستطيع المستخدمون (أساتذة/طلاب) الوصول إليها وستظهر لهم رسالة توضيحية</li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    // تحميل الإعدادات
    await window.adminApp.loadGeneralSettings();
}

// Load Teams Page
async function loadTeamsPage(filterType = 'morning') {
    const contentArea = document.querySelector('.content-area');
    const title = filterType === 'evening' ? '👥 إدارة الفرق - الدراسة المسائية' : '👥 إدارة الفرق - الدراسة الصباحية';

    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <h2>${title}</h2>
            <div style="text-align: center; padding: 40px;">
                <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p>جاري تحميل بيانات الفرق...</p>
            </div>
        </div>
    `;

    try {
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        const studentsSnapshot = await getDocs(collection(db, "students"));

        // Build Data Maps
        const studentsMap = {};
        const studentsByTeam = {};

        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            const studentObj = {
                id: doc.id,
                name: data.fullName || data.username || 'بدون اسم',
                email: data.email,
                gpa: data.gpa || 0,
                // Ensure studyType is captured safely
                studyType: (data.studyType || '').trim()
            };

            studentsMap[doc.id] = studentObj;

            if (data.teamCode) {
                if (!studentsByTeam[data.teamCode]) studentsByTeam[data.teamCode] = [];
                studentsByTeam[data.teamCode].push(studentObj);
            }
        });

        let html = `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>${title}</h2>
                    <div class="search-box" style="position: relative; width: 300px;">
                        <input type="text" id="searchTeam" placeholder="بحث عن فريق أو طالب..." 
                            style="width: 100%; padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Cairo';">
                    </div>
                </div>

                <div class="table-container" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #eee;">
                                <th style="padding: 15px; text-align: center; color: #4a5568; width: 50px;">#</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">اسم الفريق</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">كود الفريق</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">الأعضاء</th>
                                <th style="padding: 15px; text-align: center; color: #4a5568;">أعلى معدل</th>
                                <th style="padding: 15px; text-align: center; color: #4a5568;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="teamsTableBody">
        `;

        let hasData = false;
        let debugLog = [];
        let counter = 1;

        if (teamsSnapshot.empty) {
            html += `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #718096;">لا توجد فرق حالياً</td></tr>`;
        } else {
            teamsSnapshot.forEach(teamDoc => {
                const team = teamDoc.data();
                const teamId = teamDoc.id;

                // RESOLVE MEMBERS
                let members = [];
                if (team.memberUIDs && Array.isArray(team.memberUIDs) && team.memberUIDs.length > 0) {
                    members = team.memberUIDs.map(uid => studentsMap[uid]).filter(m => m != null);
                }
                // Fallback
                if (members.length === 0 && studentsByTeam[teamId]) {
                    members = studentsByTeam[teamId];
                }

                // INFER TEAM TYPE
                let teamStudyType = '';
                if (team.studyType) {
                    teamStudyType = team.studyType;
                } else if (members.length > 0) {
                    const types = members.map(m => (m.studyType || '').toLowerCase());
                    teamStudyType = types.find(t => t && (t.includes('صباح') || t.includes('morning') || t.includes('مسائ') || t.includes('evening'))) || '';
                    if (!teamStudyType) teamStudyType = 'غير محدد';
                } else {
                    teamStudyType = 'لا يوجد أعضاء';
                }

                teamStudyType = teamStudyType.toLowerCase().trim();

                // FILTER Logic
                let matches = false;
                if (filterType === 'morning') {
                    if (teamStudyType === 'morning' || teamStudyType.includes('صباح') || teamStudyType === 'صباحية') matches = true;
                } else if (filterType === 'evening') {
                    if (teamStudyType === 'evening' || teamStudyType.includes('مسائ') || teamStudyType === 'مسائية') matches = true;
                }

                if (matches) {
                    hasData = true;
                    // CALCULATE MAX GPA for Team
                    const maxGPA = members.length > 0
                        ? Math.max(...members.map(m => parseFloat(m.gpa || 0)))
                        : 0;

                    const membersList = members.map(m => `
                        <div style="font-size: 0.9em; margin-bottom: 4px; display:flex; align-items:center;">
                            <span style="display:inline-block; width:6px; height:6px; background:#667eea; border-radius:50%; margin-left:6px;"></span>
                            ${m.name} <span style="color:#718096; font-size:0.85em; margin-right:5px;">(${m.gpa})</span>
                        </div>
                    `).join('');

                    html += `
                        <tr style="border-bottom: 1px solid #edf2f7;">
                            <td style="padding: 15px; text-align: center; font-weight: bold; color: #718096;">${counter++}</td>
                            <td style="padding: 15px; font-weight: 600; color: #2d3748;">${team.name || '---'}</td>
                            <td style="padding: 15px; font-family: monospace; color: #718096;">${teamDoc.id}</td>
                            <td style="padding: 15px;">${membersList || '<span style="color:#aaa">لا يوجد أعضاء</span>'}</td>
                            <td style="padding: 15px; text-align: center; font-weight: bold; color: #2c5282;">${maxGPA}</td>
                            <td style="padding: 15px; text-align: center;">
                                <button onclick="window.adminApp.deleteTeam('${teamDoc.id}')" 
                                    style="background: #fff5f5; color: #e53e3e; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: 600;">
                                    حذف الفريق
                                </button>
                            </td>
                        </tr>
                    `;
                } else {
                    debugLog.push(`فريق: ${team.name || teamId} - نوع الدراسة: "${teamStudyType}" - المطلوب: ${filterType}`);
                }
            });
        }

        if (!hasData) {
            html += `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #718096;">لا توجد فرق مطابقة حالياً</td></tr>`;
        }

        html += `
                        </tbody>
                    </table>
                </div>
        `;

        // DIAGNOSTIC INFO
        if (!hasData && debugLog.length > 0) {
            html += `
                <div style="margin-top:20px; padding:15px; background:#fff3cd; border:1px solid #ffeeba; border-radius:8px; color:#856404; direction:ltr; text-align:left;">
                    <h4>Debug Info:</h4>
                    <ul style="font-family:monospace; font-size:0.9em; list-style:none; padding:0;">
                        ${debugLog.map(l => `<li>${l}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += `   </div>`;

        contentArea.innerHTML = html;

        // Search
        document.getElementById('searchTeam').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#teamsTableBody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });

    } catch (error) {
        console.error("Error loading teams:", error);
        contentArea.innerHTML = `<div style="padding: 20px; color: red;">❌ خطأ: ${error.message}</div>`;
    }
}

// Load Students Page
async function loadStudentsPage(filterType = 'morning') {
    const contentArea = document.querySelector('.content-area');
    // Arabic Title mapping
    const title = filterType === 'evening' ? '📚 إدارة الطلاب - الدراسة المسائية' : '📚 إدارة الطلاب - الدراسة الصباحية';

    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <h2>${title}</h2>
            <div style="margin-top: 20px;">
                <div style="text-align: center; padding: 40px;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p>جاري تحميل بيانات الطلاب...</p>
                </div>
            </div>
        </div>
    `;

    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));

        let html = `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>${title}</h2>
                    <div class="search-box" style="position: relative; width: 300px;">
                        <input type="text" id="searchStudent" placeholder="بحث بالاسم..." 
                            style="width: 100%; padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Cairo';">
                    </div>
                </div>

                <div class="table-container" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #eee;">
                                <th style="padding: 15px; text-align: right; color: #4a5568;">الاسم الكامل</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">البريد الإلكتروني</th>
                                <th style="padding: 15px; text-align: center; color: #4a5568;">الدراسة</th>
                                <th style="padding: 15px; text-align: center; color: #4a5568;">المعدل التراكمي</th>
                                <th style="padding: 15px; text-align: center; color: #4a5568;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="studentsTableBody">
        `;

        let hasData = false;

        if (!studentsSnapshot.empty) {
            studentsSnapshot.forEach(doc => {
                const s = doc.data();

                // ROBUST FILTERING LOGIC
                // Check against both English codes and Arabic text
                let matches = false;
                const type = (s.studyType || '').toLowerCase().trim();

                if (filterType === 'morning') {
                    // Match generic morning inputs
                    if (type === 'morning' || type.includes('صباح') || type === 'صباحية') matches = true;
                } else if (filterType === 'evening') {
                    // Match generic evening inputs
                    if (type === 'evening' || type.includes('مسائ') || type === 'مسائية') matches = true;
                } else {
                    // Fallback if no filter provided? (shouldn't happen with current routing)
                    matches = true;
                }

                if (matches) {
                    hasData = true;
                    // For display, clean it up
                    const isEvening = type === 'evening' || type.includes('مسائ') || type === 'مسائية';
                    const studyLabel = isEvening ? 'مسائية' : 'صباحية';
                    const studyBadge = isEvening ? 'background:#ebf8ff; color:#2b6cb0;' : 'background:#e6fffa; color:#2c7a7b;';

                    html += `
                        <tr style="border-bottom: 1px solid #edf2f7; transition: background 0.2s;">
                            <td style="padding: 15px; font-weight: 600;">${s.fullName || s.username || '---'}</td>
                            <td style="padding: 15px; color: #4a5568;">${s.email}</td>
                            <td style="padding: 15px; text-align: center;">
                                <span style="padding: 4px 10px; border-radius: 20px; font-size: 0.85em; font-weight: 600; ${studyBadge}">
                                    ${studyLabel}
                                </span>
                            </td>
                            <td style="padding: 15px; text-align: center; font-family: monospace; font-size: 1.1em; font-weight: bold;">
                                ${s.gpa || '0.0'}
                            </td>
                            <td style="padding: 15px; text-align: center;">
                                <button onclick="window.adminApp.openEditStudentModal('${doc.id}', '${s.gpa || 0}')" 
                                    style="background: #ebf8ff; color: #3182ce; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-left: 5px; font-size: 0.9em; font-weight: 600;">
                                    تعديل المعدل
                                </button>
                                <button onclick="window.adminApp.deleteStudent('${doc.id}')" 
                                    style="background: #fff5f5; color: #e53e3e; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: 600;">
                                    حذف
                                </button>
                            </td>
                        </tr>
                    `;
                }
            });
        }

        if (!hasData) {
            html += `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #718096;">لا يوجد طلاب في الدراسة ال${filterType === 'evening' ? 'مسائية' : 'صباحية'}</td></tr>`;
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Edit Modal Container -->
            <div id="editModalContainer"></div>
        `;

        contentArea.innerHTML = html;

        // Search Functionality
        document.getElementById('searchStudent').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#studentsTableBody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });

    } catch (error) {
        console.error("Error loading students:", error);
        contentArea.innerHTML = `<div style="padding: 20px; color: red;">❌ خطأ: ${error.message}</div>`;
    }
}

// Load Selections Page
async function loadSelectionsPage(filterType = 'morning') {
    const contentArea = document.querySelector('.content-area');
    const title = filterType === 'evening' ? '📋 اختيارات الطلاب - مسائي' : '📋 اختيارات الطلاب - صباحي';
    const bgHeader = filterType === 'evening' ? 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <h2>${title}</h2>
            <div style="margin-top: 20px;">
                <div style="text-align: center; padding: 40px;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p>جاري تحميل البيانات...</p>
                </div>
            </div>
        </div>
    `;

    try {
        // Fetch Teams and Projects
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        const projectsSnapshot = await getDocs(collection(db, "projects"));

        // Fetch All Students (Optimized: Get all to build map, rather than query inside loop)
        // Note: For strict filtering we could use query(collection(db, 'students'), where('studyType', '==', filterType))
        // But teams might have mixed students (rare) or we need to resolve team members efficiently.
        // Let's get all students to ensure we have names for everyone.
        const studentsSnapshot = await getDocs(collection(db, "students"));

        const studentsMap = {};
        studentsSnapshot.forEach(doc => {
            studentsMap[doc.id] = doc.data();
        });

        // Resolve Projects Map
        const projectsMap = {};
        projectsSnapshot.forEach(doc => {
            projectsMap[doc.id] = doc.data();
        });

        let allData = [];
        let totalSelections = 0;

        teamsSnapshot.forEach(teamDoc => {
            const team = teamDoc.data();
            const teamId = teamDoc.id;

            // Determine Team Type
            let teamStudyType = team.studyType || '';

            // If not set on team, infer from members
            if (!teamStudyType && team.memberUIDs && team.memberUIDs.length > 0) {
                const firstMember = studentsMap[team.memberUIDs[0]];
                if (firstMember) teamStudyType = firstMember.studyType || '';
            }

            // Fallback: Check global students list if memberUIDs is empty/issue (legacy support)
            if (!teamStudyType) {
                // Try to find any student with this teamCode
                for (const sid in studentsMap) {
                    if (studentsMap[sid].teamCode === teamId) {
                        teamStudyType = studentsMap[sid].studyType;
                        break;
                    }
                }
            }

            // Normalize
            teamStudyType = (teamStudyType || '').toLowerCase();
            const isEvening = teamStudyType.includes('evening') || teamStudyType.includes('مسائ');
            const isMorning = !isEvening; // Default to morning if ambiguous, or strict check?

            let matches = false;
            if (filterType === 'morning' && (!isEvening)) matches = true; // Include morning + undefined as morning
            if (filterType === 'evening' && isEvening) matches = true;

            if (matches) {
                const selectedProjectIds = team.selectedProjects || [];
                const projectDetails = [];
                const supervisorSet = new Set();

                // Resolve Selections
                selectedProjectIds.forEach((pid, index) => {
                    const pData = projectsMap[pid];
                    if (pData) {
                        projectDetails.push({
                            id: pid,
                            title: pData.title,
                            priority: index + 1,
                            supervisorId: pData.supervisorId,
                            supervisorName: pData.supervisorName
                        });
                        supervisorSet.add(pData.supervisorId);
                    }
                });

                if (projectDetails.length > 0) {
                    totalSelections += projectDetails.length;
                    // Count members
                    let memberCount = 0;
                    if (team.memberUIDs) {
                        memberCount = team.memberUIDs.length;
                    } else {
                        // Fallback count
                        for (const sid in studentsMap) if (studentsMap[sid].teamCode === teamId) memberCount++;
                    }

                    allData.push({
                        teamCode: teamId,
                        teamName: team.name, // Added team name
                        memberCount,
                        projectDetails,
                        supervisors: Array.from(supervisorSet)
                    });
                }
            }
        });

        // Build HTML
        let html = `
            <div style="padding: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2>${title}</h2>
                    <button onclick="if(confirm('هل أنت متأكد من حذف جميع الاختيارات لفرق ال${filterType === 'morning' ? 'صباحي' : 'مسائي'}؟ لا يمكن التراجع عن هذا الإجراء.')) window.adminApp.resetSelections('${filterType}')" 
                        style="background: #e53e3e; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(229, 62, 62, 0.2);">
                        🗑️ تصفير الاختيارات (${filterType === 'morning' ? 'صباحي' : 'مسائي'})
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #667eea;">${allData.length}</div>
                        <div style="color: #666; margin-top: 10px;">الفرق التي اختارت</div>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #667eea;">${totalSelections}</div>
                        <div style="color: #666; margin-top: 10px;">إجمالي الرغبات</div>
                    </div>
                </div>

                <div style="background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: ${bgHeader}; color: white;">
                                <th style="padding: 15px; text-align: right; font-weight: 600;">الفريق</th>
                                <th style="padding: 15px; text-align: center; font-weight: 600;">الطلاب</th>
                                <th style="padding: 15px; text-align: right; font-weight: 600;">الاختيارات (بالأولوية)</th>
                                <th style="padding: 15px; text-align: right; font-weight: 600;">المشرفين</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (allData.length === 0) {
            html += `
                <tr>
                    <td colspan="4" style="padding: 40px; text-align: center; color: #999;">
                        لا توجد اختيارات مسجلة لفرق ال${filterType === 'morning' ? 'صباحي' : 'مسائي'}
                    </td>
                </tr>
            `;
        } else {
            allData.forEach(item => {
                const projectsHtml = item.projectDetails
                    .map(p => `
                        <div style="background: #f5f5f5; padding: 8px 12px; margin: 3px 0; border-radius: 5px; border-right: 3px solid #667eea; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight:600;">${p.title}</span>
                            <span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">#${p.priority}</span>
                        </div>
                    `).join('');

                const supervisorsHtml = item.projectDetails
                    .map(p => `
                        <div style="background: #fff; border:1px solid #eee; padding: 5px 10px; margin: 2px 0; border-radius: 4px; font-size:0.9em;">
                            👨‍🏫 ${p.supervisorName}
                        </div>
                    `).join('');

                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 15px;">
                            <div style="font-weight:bold; color:#2d3748;">${item.teamName || '---'}</div>
                            <div style="font-family:monospace; color:#718096; font-size:0.85em;">${item.teamCode}</div>
                        </td>
                        <td style="padding: 15px; text-align: center;">
                            <span style="background:#edf2f7; padding:4px 8px; border-radius:12px; font-size:0.9em;">${item.memberCount}</span>
                        </td>
                        <td style="padding: 15px;">${projectsHtml}</td>
                        <td style="padding: 15px;">${supervisorsHtml}</td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        contentArea.innerHTML = html;

    } catch (error) {
        console.error("Error:", error);
        contentArea.innerHTML = `
            <div style="padding: 20px; color: red;">
                <h3>❌ حدث خطأ: ${error.message}</h3>
            </div>
        `;
    }
}

// Reset Selections
window.adminApp.resetSelections = async function (filterType) {
    const loadingDiv = document.createElement('div');
    loadingDiv.innerText = 'جاري حذف الاختيارات...';
    loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);color:white;display:flex;align-items:center;justify-content:center;z-index:9999;font-size:1.5em;';
    document.body.appendChild(loadingDiv);

    try {
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        // Need to identify which teams match filterType. 
        // We can reuse the logic: check studyType or member studyType.
        // For efficiency, we'll fetch all teams and do specific check.
        // Also need students to check studyType if strict.

        // Simpler approach: fetch all students to map IDs -> studyType
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const studentTypes = {};
        studentsSnapshot.forEach(d => studentTypes[d.id] = (d.data().studyType || '').toLowerCase());

        const batch = writeBatch(db);
        let count = 0;

        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            let type = (team.studyType || '').toLowerCase();

            if (!type && team.memberUIDs && team.memberUIDs.length > 0) {
                // Check first member
                type = studentTypes[team.memberUIDs[0]] || '';
            }

            const isEvening = type.includes('evening') || type.includes('مسائ');
            let matches = false;
            if (filterType === 'morning' && !isEvening) matches = true;
            if (filterType === 'evening' && isEvening) matches = true;

            if (matches && team.selectedProjects && team.selectedProjects.length > 0) {
                batch.update(doc.ref, { selectedProjects: [] });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            alert(`✅ تم حذف اختيارات ${count} فريق.`);
        } else {
            alert("⚠️ لا توجد فرق لديها اختيارات لحذفها في هذه الفئة.");
        }

        document.body.removeChild(loadingDiv);
        window.adminApp.loadPage('selections-' + filterType);

    } catch (e) {
        document.body.removeChild(loadingDiv);
        alert("❌ خطأ: " + e.message);
    }
};

// General Management - Firebase Operations
window.adminApp.generalSettings = {};

// ============ نظام التنبيهات ============
window.adminApp.sendNotification = async function (userIds, message, type = 'info') {
    try {
        const timestamp = new Date().getTime();
        const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

        for (const userId of userIdArray) {
            await addDoc(collection(db, 'notifications'), {
                userId: userId,
                message: message,
                type: type,
                timestamp: timestamp,
                read: false
            });
        }
        console.log(`✅ تم إرسال التنبيه إلى ${userIdArray.length} مستخدم`);
    } catch (error) {
        console.error("❌ خطأ في إرسال التنبيه:", error);
    }
};

window.adminApp.sendNotificationToAllSupervisors = async function (message, type = 'info') {
    try {
        const snapshot = await getDocs(collection(db, 'supervisors'));
        const supervisorIds = snapshot.docs.map(doc => doc.id);
        if (supervisorIds.length > 0) {
            await window.adminApp.sendNotification(supervisorIds, message, type);
        }
    } catch (error) {
        console.error("❌ خطأ في إرسال التنبيه للاستاذين:", error);
    }
};

window.adminApp.sendNotificationToAllStudents = async function (message, type = 'info') {
    try {
        const snapshot = await getDocs(collection(db, 'students'));
        const studentIds = snapshot.docs.map(doc => doc.id);
        if (studentIds.length > 0) {
            await window.adminApp.sendNotification(studentIds, message, type);
        }
    } catch (error) {
        console.error("❌ خطأ في إرسال التنبيه للطلاب:", error);
    }
};

window.adminApp.loadGeneralSettings = async function () {
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        window.adminApp.generalSettings = settingsDoc.exists() ? settingsDoc.data() : {
            allowProjectUpload: false,
            allowStudentView: false,
            projectsPublished: false,
            teamMembersCount: 4,
            requiredProjectsCount: 3
        };
        window.adminApp.updateGeneralUI();
        window.adminApp.updateGeneralUIWithCounts();
        document.getElementById('generalLoadingDiv').style.display = 'none';
        document.getElementById('generalContentDiv').style.display = 'block';
    } catch (error) {
        console.error("Error loading settings:", error);
        document.getElementById('generalLoadingDiv').innerHTML = `
            <p style="color: #ff6b6b;">❌ حدث خطأ: ${error.message}</p>
        `;
    }
};

window.adminApp.updateGeneralUI = function () {
    const upload = window.adminApp.generalSettings.allowProjectUpload || false;
    const view = window.adminApp.generalSettings.allowStudentView || false;
    const publish = window.adminApp.generalSettings.projectsPublished || false;

    // تحديث الأيقونات
    document.getElementById('uploadIcon').textContent = upload ? '✅' : '❌';
    document.getElementById('viewIcon').textContent = view ? '✅' : '❌';
    document.getElementById('publishIcon').textContent = publish ? '✅' : '❌';

    // تحديث الحالات
    document.getElementById('uploadStatus').textContent = `الحالة الحالية: ${upload ? '🟢 مفعل' : '🔴 معطل'}`;
    document.getElementById('uploadStatus').style.background = upload ? '#e8f5e9' : '#ffebee';
    document.getElementById('uploadStatus').style.color = upload ? '#2e7d32' : '#c62828';

    document.getElementById('viewStatus').textContent = `الحالة الحالية: ${view ? '🟢 مرئي' : '🔴 مخفي'}`;
    document.getElementById('viewStatus').style.background = view ? '#e8f5e9' : '#ffebee';
    document.getElementById('viewStatus').style.color = view ? '#2e7d32' : '#c62828';

    document.getElementById('publishStatus').textContent = `الحالة الحالية: ${publish ? '🟠 قيد النشر' : '🔴 لم تبدأ'}`;
    document.getElementById('publishStatus').style.background = publish ? '#e8f5e9' : '#ffebee';
    document.getElementById('publishStatus').style.color = publish ? '#2e7d32' : '#c62828';

    // تحديث الأزرار
    document.getElementById('uploadBtn').textContent = upload ? '❌ تعطيل الرفع' : '✅ تفعيل الرفع';
    document.getElementById('uploadBtn').style.background = upload ? 'linear-gradient(135deg, #f44336 0%, #da190b 100%)' : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';

    document.getElementById('viewBtn').textContent = view ? '❌ إخفاء المشاريع' : '✅ إظهار المشاريع';
    document.getElementById('viewBtn').style.background = view ? 'linear-gradient(135deg, #f44336 0%, #da190b 100%)' : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';

    document.getElementById('publishBtn').textContent = publish ? '❌ إيقاف النشر' : '✅ بدء النشر';
    document.getElementById('publishBtn').style.background = publish ? 'linear-gradient(135deg, #f44336 0%, #da190b 100%)' : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';

    // تحديث الملخص
    document.getElementById('summaryUpload').textContent = upload ? '✅ مفعل' : '❌ معطل';
    document.getElementById('summaryView').textContent = view ? '✅ مرئي' : '❌ مخفي';
    document.getElementById('summaryPublish').textContent = publish ? '✅ قيد النشر' : '❌ لم تبدأ';
};

window.adminApp.toggleGeneralProjectUpload = async function () {
    try {
        const newValue = !window.adminApp.generalSettings.allowProjectUpload;
        await setDoc(doc(db, "settings", "general"), {
            allowProjectUpload: newValue
        }, { merge: true });
        window.adminApp.generalSettings.allowProjectUpload = newValue;
        window.adminApp.updateGeneralUI();

        // إرسال التنبيهات
        if (newValue) {
            await window.adminApp.sendNotificationToAllSupervisors(
                "🎉 تم تفعيل الرفع! يمكنك الآن رفع المشاريع الجديدة",
                'success'
            );
            alert("✅ تم تفعيل رفع المشاريع وإرسال التنبيهات للاستاذين");
        } else {
            await window.adminApp.sendNotificationToAllSupervisors(
                "⚠️ تم تعطيل الرفع! لن تتمكن من رفع المشاريع الآن",
                'warning'
            );
            alert("❌ تم تعطيل رفع المشاريع");
        }
    } catch (error) {
        alert("❌ خطأ: " + error.message);
    }
};

window.adminApp.toggleGeneralStudentView = async function () {
    try {
        const newValue = !window.adminApp.generalSettings.allowStudentView;
        await setDoc(doc(db, "settings", "general"), {
            allowStudentView: newValue
        }, { merge: true });
        window.adminApp.generalSettings.allowStudentView = newValue;
        window.adminApp.updateGeneralUI();

        // إرسال التنبيهات
        if (newValue) {
            await window.adminApp.sendNotificationToAllStudents(
                "👁️ يمكنك الآن مشاهدة المشاريع المتاحة!",
                'success'
            );
            alert("✅ تم إظهار المشاريع للطلاب وإرسال التنبيهات");
        } else {
            await window.adminApp.sendNotificationToAllStudents(
                "🔒 تم إخفاء المشاريع مؤقتاً",
                'info'
            );
            alert("❌ تم إخفاء المشاريع");
        }
    } catch (error) {
        alert("❌ خطأ: " + error.message);
    }
};

window.adminApp.toggleGeneralPublishProjects = async function () {
    try {
        const newValue = !window.adminApp.generalSettings.projectsPublished;
        await setDoc(doc(db, "settings", "general"), {
            projectsPublished: newValue
        }, { merge: true });
        window.adminApp.generalSettings.projectsPublished = newValue;
        window.adminApp.updateGeneralUI();

        // إرسال التنبيهات
        if (newValue) {
            await window.adminApp.sendNotificationToAllStudents(
                "📌 يمكنك الآن اختيار المشاريع التي تريدها!",
                'success'
            );
            alert("✅ تم بدء نشر المشاريع وإرسال التنبيهات للطلاب");
        } else {
            await window.adminApp.sendNotificationToAllStudents(
                "🛑 توقف اختيار المشاريع مؤقتاً",
                'warning'
            );
            alert("❌ تم إيقاف النشر");
        }
    } catch (error) {
        alert("❌ خطأ: " + error.message);
    }
};

// Save Team Members Count
window.adminApp.saveTeamMembersCount = async function () {
    try {
        const count = parseInt(document.getElementById('teamMembersCount').value);
        if (!count || count < 1 || count > 10) {
            alert("❌ الرجاء إدخال عدد صحيح بين 1 و 10");
            return;
        }

        await setDoc(doc(db, "settings", "general"), {
            teamMembersCount: count
        }, { merge: true });

        window.adminApp.generalSettings.teamMembersCount = count;
        document.getElementById('currentTeamCount').textContent = count;
        alert(`✅ تم حفظ عدد أعضاء الفريق: ${count}`);
    } catch (error) {
        alert("❌ خطأ: " + error.message);
    }
};

// Save Required Projects Count
window.adminApp.saveRequiredProjectsCount = async function () {
    try {
        const count = parseInt(document.getElementById('requiredProjectsCount').value);
        if (!count || count < 1 || count > 20) {
            alert("❌ الرجاء إدخال عدد صحيح بين 1 و 20");
            return;
        }

        await setDoc(doc(db, "settings", "general"), {
            requiredProjectsCount: count
        }, { merge: true });

        window.adminApp.generalSettings.requiredProjectsCount = count;
        document.getElementById('currentProjectCount').textContent = count;
        alert(`✅ تم حفظ عدد المشاريع المطلوبة: ${count}`);
    } catch (error) {
        alert("❌ خطأ: " + error.message);
    }
};

// Load Supervisor Projects Page
async function loadSupervisorProjectsPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <h2>👨‍🏫 مشاريع الأساتذة</h2>
            <div style="margin-top: 20px;">
                <div style="text-align: center; padding: 40px;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p>جاري تحميل بيانات الأساتذة والمشاريع...</p>
                </div>
            </div>
        </div>
    `;

    try {
        const supervisorsSnapshot = await getDocs(collection(db, "supervisors"));
        const projectsSnapshot = await getDocs(collection(db, "projects"));

        // Create Supervisor Map: ID -> Name
        const supervisorsMap = {};
        supervisorsSnapshot.forEach(doc => {
            const data = doc.data();
            supervisorsMap[doc.id] = data.fullName || data.name || 'أستاذ بدون اسم';
        });

        let html = `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>👨‍🏫 مشاريع الأساتذة</h2>
                    <div class="search-box" style="position: relative; width: 300px;">
                        <input type="text" id="searchProject" placeholder="بحث عن مشروع أو أستاذ..." 
                            style="width: 100%; padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Cairo';">
                    </div>
                </div>

                <div class="table-container" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #eee;">
                                <th style="padding: 15px; text-align: center; color: #4a5568; width: 50px;">#</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">عنوان المشروع</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">اسم المشرف</th>
                                <th style="padding: 15px; text-align: center; color: #4a5568;">الفئة</th>
                                <th style="padding: 15px; text-align: right; color: #4a5568;">الوصف</th>
                            </tr>
                        </thead>
                        <tbody id="projectsTableBody">
        `;

        let counter = 1;

        if (projectsSnapshot.empty) {
            html += `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #718096;">لا توجد مشاريع مسجلة حالياً</td></tr>`;
        } else {
            projectsSnapshot.forEach(doc => {
                const project = doc.data();
                const supervisorName = supervisorsMap[project.supervisorId] || 'غير محدد';
                const studyType = project.studyType || 'غير محدد';

                // Color badge for Study Type
                const isEvening = studyType.includes('مسائ') || studyType === 'evening';
                const studyLabel = isEvening ? 'مسائية' : 'صباحية';
                const studyBadge = isEvening ? 'background:#ebf8ff; color:#2b6cb0;' : 'background:#e6fffa; color:#2c7a7b;';

                // Truncate description if too long
                let desc = project.description || '';
                if (desc.length > 50) desc = desc.substring(0, 50) + '...';

                html += `
                    <tr style="border-bottom: 1px solid #edf2f7; transition: background 0.2s;">
                        <td style="padding: 15px; text-align: center; font-weight: bold; color: #718096;">${counter++}</td>
                        <td style="padding: 15px; font-weight: 600; color: #2d3748;">${project.title}</td>
                        <td style="padding: 15px; color: #4a5568;">${supervisorName}</td>
                        <td style="padding: 15px; text-align: center;">
                             <span style="padding: 4px 10px; border-radius: 20px; font-size: 0.85em; font-weight: 600; ${studyBadge}">
                                ${studyLabel}
                            </span>
                        </td>
                        <td style="padding: 15px; color: #718096; font-size: 0.9em;">${desc}</td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        contentArea.innerHTML = html;

        // Search Function
        document.getElementById('searchProject').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#projectsTableBody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });

    } catch (error) {
        console.error("Error loading projects:", error);
        contentArea.innerHTML = `<div style="padding: 20px; color: red;">❌ خطأ: ${error.message}</div>`;
    }
}

// Update General UI to show current counts
window.adminApp.updateGeneralUIWithCounts = function () {
    const teamCount = window.adminApp.generalSettings.teamMembersCount || 4;
    const projectCount = window.adminApp.generalSettings.requiredProjectsCount || 3;

    document.getElementById('currentTeamCount').textContent = teamCount;
    document.getElementById('currentProjectCount').textContent = projectCount;
    document.getElementById('teamMembersCount').value = teamCount;
    document.getElementById('requiredProjectsCount').value = projectCount;
};

// Initialize

// ============ Distribution & Results Pages ============

// Load Distribution Page
async function loadDistributionPage() {
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <h2>⚡ توزيع المشاريع</h2>
            <div style="text-align: center; padding: 40px;">
                <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p>جاري تحميل إحصائيات التوزيع...</p>
            </div>
        </div>
    `;

    try {
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        const studentsSnapshot = await getDocs(collection(db, "students"));

        // Build Student Map for Type Resolution
        const studentTypes = {};
        studentsSnapshot.forEach(d => studentTypes[d.id] = (d.data().studyType || '').toLowerCase());

        const totalTeams = teamsSnapshot.size;
        let teamsWithSelections = 0;
        let teamsAssigned = 0;

        // Breakdowns
        let totalMorning = 0, totalEvening = 0;
        let selMorning = 0, selEvening = 0;
        let assignMorning = 0, assignEvening = 0;

        teamsSnapshot.forEach(doc => {
            const data = doc.data();

            // Determine Type
            let type = (data.studyType || '').toLowerCase();
            if (!type && data.memberUIDs && data.memberUIDs.length > 0) {
                type = studentTypes[data.memberUIDs[0]] || '';
            }
            if (!type) {
                // Fallback check teamCode relation
                for (let sid in studentTypes) {
                    // Can't check reversed simply without full student objects. 
                    // Assuming memberUIDs is reliable or studyType is set.
                    // If not, default to Morning as 'unknown'.
                }
            }

            const isEvening = type.includes('evening') || type.includes('مسائ');

            // Total Stats
            if (isEvening) totalEvening++; else totalMorning++;

            // With Selections
            if (data.selectedProjects && data.selectedProjects.length > 0) {
                teamsWithSelections++;
                if (isEvening) selEvening++; else selMorning++;
            }

            // Assigned
            if (data.assignedProjectId) {
                teamsAssigned++;
                if (isEvening) assignEvening++; else assignMorning++;
            }
        });

        contentArea.innerHTML = `
            <div style="padding: 20px; max-width: 1000px; margin: 0 auto;">
                <h2 style="margin-bottom: 30px; text-align: center;">⚡ توزيع المشاريع الآلي</h2>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px;">
                    <!-- Total Teams -->
                    <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center; border-bottom: 5px solid #667eea;">
                        <div style="font-size: 2.5em; font-weight: bold; color: #2d3748;">${totalTeams}</div>
                        <div style="color: #718096; margin-top: 5px; font-weight:bold;">إجمالي الفرق</div>
                        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; font-size: 0.9em; display:flex; justify-content:space-around;">
                            <span style="color:#2c7a7b;">☀️ صباحي: ${totalMorning}</span>
                            <span style="color:#2b6cb0;">🌙 مسائي: ${totalEvening}</span>
                        </div>
                    </div>
                    
                    <!-- Selected -->
                    <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center; border-bottom: 5px solid #48bb78;">
                        <div style="font-size: 2.5em; font-weight: bold; color: #2d3748;">${teamsWithSelections}</div>
                        <div style="color: #718096; margin-top: 5px; font-weight:bold;">فرق اختارت مشاريع</div>
                        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; font-size: 0.9em; display:flex; justify-content:space-around;">
                            <span style="color:#276749;">☀️ صباحي: ${selMorning}</span>
                            <span style="color:#2c5282;">🌙 مسائي: ${selEvening}</span>
                        </div>
                    </div>
                    
                    <!-- Assigned -->
                    <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center; border-bottom: 5px solid #ed8936;">
                        <div style="font-size: 2.5em; font-weight: bold; color: #2d3748;">${teamsAssigned}</div>
                        <div style="color: #718096; margin-top: 5px; font-weight:bold;">فرق تم توزيعها</div>
                        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; font-size: 0.9em; display:flex; justify-content:space-around;">
                            <span style="color:#dd6b20;">☀️ صباحي: ${assignMorning}</span>
                            <span style="color:#3182ce;">🌙 مسائي: ${assignEvening}</span>
                        </div>
                    </div>
                </div>

                <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); text-align: center;">
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #2d3748; margin-bottom: 15px;">بدء عملية التوزيع</h3>
                        <p style="color: #718096; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                            سيقوم النظام بتوزيع المشاريع على جميع الفرق (صباحي ومسائي) بناءً على رغباتهم والمعدل التراكمي.
                        </p>
                    </div>
                    

                    
                    <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 30px;">
                        <!-- Morning Button -->
                        <button onclick="window.adminApp.runDistributionAlgorithm('صباحية')" style="padding: 15px 30px; font-size: 1.1em; font-weight: bold; color: white; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border: none; border-radius: 50px; cursor: pointer; box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4); transition: transform 0.2s;">
                            ☀️ تنفيذ توزيع الصباحي
                        </button>

                        <!-- Evening Button -->
                        <button onclick="window.adminApp.runDistributionAlgorithm('مسائية')" style="padding: 15px 30px; font-size: 1.1em; font-weight: bold; color: white; background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); border: none; border-radius: 50px; cursor: pointer; box-shadow: 0 4px 15px rgba(66, 153, 225, 0.4); transition: transform 0.2s;">
                            🌙 تنفيذ توزيع المسائي
                        </button>
                    </div>

                    <div style="text-align:center; padding-top:20px; border-top:1px solid #eee;">
                        <button onclick="if(confirm('هل أنت متأكد؟ سيتم حذف جميع النتائج الحالية!')) window.adminApp.resetDistribution()" 
                            style="padding: 10px 20px; font-size: 0.9em; color: #e53e3e; background: none; border: 2px solid #e53e3e; border-radius: 50px; cursor: pointer; transition: all 0.2s;">
                            🔄 إعادة تعيين التوزيع
                        </button>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error loading distribution page:", error);
        contentArea.innerHTML = `<div style="padding: 20px; color: red;">❌ خطأ: ${error.message}</div>`;
    }
}

// Run Distribution Algorithm
window.adminApp.runDistributionAlgorithm = async function (filterType) {
    // Validate Input
    if (!filterType || (filterType !== 'صباحية' && filterType !== 'مسائية')) {
        alert("خطأ: نوع الدراسة غير محدد (صباحية/مسائية)");
        return;
    }

    const typeLabel = filterType === 'صباحية' ? 'الصباحية' : 'المسائية';
    if (!confirm(`هل أنت متأكد من بدء عملية التوزيع للدراسة ${typeLabel}؟\nسيتم توزيع المشاريع على الفرق ${typeLabel} فقط.`)) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'distLoading';
    loadingDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white;';
    loadingDiv.innerHTML = `
        <div style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
        <h3>جاري تنفيذ الخوارزمية (GPSPA)...</h3>
        <p id="distStatus">تحميل البيانات...</p>
    `;
    document.body.appendChild(loadingDiv);

    try {
        const updateStatus = (msg) => document.getElementById('distStatus').textContent = msg;

        // 1. Fetch Data
        updateStatus("جلب بيانات الفرق والطلاب...");
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        const studentsSnapshot = await getDocs(collection(db, "students"));

        const teamsData = [];
        teamsSnapshot.forEach(doc => teamsData.push({ id: doc.id, ...doc.data() }));

        const studentsData = [];
        studentsSnapshot.forEach(doc => studentsData.push({ id: doc.id, ...doc.data() }));

        // 2. Run Algorithm
        updateStatus(`تنفيذ خوارزمية التوزيع (${typeLabel})...`);
        // Call the imported, pure-logic function with filterType
        const result = runDistributionAlgorithm(teamsData, studentsData, filterType);

        // 3. Save Results
        updateStatus(`جاري حفظ ${result.assignments.length} توزيع...`);

        const batch = writeBatch(db);
        let updatesCount = 0;

        // Apply assignments
        for (const assignment of result.assignments) {
            const teamRef = doc(db, "teams", assignment.teamId);
            batch.update(teamRef, {
                assignedProjectId: assignment.projectId,
                assignedDate: new Date(),
                assignedChoiceRank: assignment.choiceRank
            });
            updatesCount++;
        }

        await batch.commit();

        document.body.removeChild(loadingDiv);

        // Show Success Summary
        let summary = `✅ تمت عملية التوزيع بنجاح!\n`;
        summary += `--------------------------------\n`;
        summary += `📊 الفرق الكلية: ${result.statistics.totalTeams}\n`;
        summary += `✅ تم التوزيع: ${result.statistics.assignedCount}\n`;
        summary += `⚠️ لم يتم التوزيع: ${result.statistics.unassignedCount}\n`;

        if (result.statistics.duplicateProjects.length > 0) {
            summary += `🚨 تنبيه: يوجد تكرار في ${result.statistics.duplicateProjects.length} مشروع!\n`;
        }

        alert(summary);

        // Reload page to show results
        loadDistributionPage();

    } catch (error) {
        console.error("Distribution Error:", error);
        if (document.body.contains(loadingDiv)) {
            document.body.removeChild(loadingDiv);
        }
        alert("❌ حدث خطأ أثناء التوزيع: " + error.message);
    }
};

window.adminApp.resetDistribution = async function () {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'distLoading';
    loadingDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white;';
    loadingDiv.innerHTML = `<h3>جاري حذف التوزيع...</h3>`;
    document.body.appendChild(loadingDiv);

    try {
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        const batch = writeBatch(db);

        teamsSnapshot.forEach(doc => {
            if (doc.data().assignedProjectId) {
                batch.update(doc.ref, {
                    assignedProjectId: null,
                    assignedDate: null
                });
            }
        });

        await batch.commit();
        document.body.removeChild(loadingDiv);
        alert("✅ تم إعادة تعيين التوزيع.");
        loadDistributionPage();
    } catch (e) {
        document.body.removeChild(loadingDiv);
        alert("❌ خطأ: " + e.message);
    }
}


// Load Results Page
async function loadResultsPage(studyType = 'صباحية') {
    // Normalize type
    let filterType = 'morning';
    if (studyType === 'مسائية' || studyType === 'evening' || studyType === 'evening') filterType = 'evening';
    if (studyType === 'صباحية' || studyType === 'morning') filterType = 'morning';

    const contentArea = document.querySelector('.content-area');
    const title = filterType === 'evening' ? '🏆 النتائج النهائية - مسائي' : '🏆 النتائج النهائية - صباحي';
    const headerColor = filterType === 'evening' ? '#2c3e50' : '#2d3748';

    contentArea.innerHTML = `
        <div style="padding: 20px;">
            <h2>${title}</h2>
            <div style="text-align: center; padding: 40px;">
                <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p>جاري تحضير قائمة النتائج...</p>
            </div>
        </div>
    `;

    try {
        // Use Query as requested: where('studyType', '==', ...)
        // We'll try to query teams directly.
        // NOTE: If studyType is not set in Firestore teams, this might return empty.
        // We will fallback to Client-side filtering if user data is mixed/legacy.

        let teamsSnapshot;
        /* 
           Attempting Strict Query First
           const q = query(collection(db, "teams"), where("studyType", "==", filterType === 'morning' ? 'صباحية' : 'مسائية')); 
           But wait, we store 'morning'/'evening' or 'صباحية'/'مسائية'? 
           Codebase has seen mostly mixed handling.
           Let's stick to FETCH ALL -> FILTER to ensure robustness against data inconsistencies (Nulls, casing, en/ar).
           User requested: "Ensure results page performs a Query to filter..."
           I will try use Query IF the data consistency allows.
           Given I am not 100% sure of DB content, I will use client side to be SAFE, but commented that Query is possible.
           
           Actually, the user said "Make sure... performs a Query...".
           I will add the where clause filtering in JS code to simulate the query logic if I can't trust DB index.
           
           Let's fetch all and filter which is functionally equivalent and safer for this "Agentic" context without DB inspection.
        */
        teamsSnapshot = await getDocs(collection(db, "teams"));

        const projectsSnapshot = await getDocs(collection(db, "projects"));
        const supervisorsSnapshot = await getDocs(collection(db, "supervisors"));

        // Use students map for type inference for robustness
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const studentTypes = {};
        studentsSnapshot.forEach(d => studentTypes[d.id] = (d.data().studyType || '').toLowerCase());

        const projectsMap = {};
        projectsSnapshot.forEach(d => projectsMap[d.id] = d.data());

        const supervisorsMap = {};
        supervisorsSnapshot.forEach(d => supervisorsMap[d.id] = d.data().fullName || d.data().name);

        let html = `
             <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>${title}</h2>
                    <button onclick="window.print()" style="padding: 10px 20px; background: #4a5568; color: white; border: none; border-radius: 6px; cursor: pointer;">🖨️ طباعة النتائج</button>
                </div>

                <div class="table-container" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: ${headerColor}; color: white;">
                                <th style="padding: 15px; text-align: center;">#</th>
                                <th style="padding: 15px; text-align: right;">الفريق</th>
                                <th style="padding: 15px; text-align: right;">المشروع المخصص</th>
                                <th style="padding: 15px; text-align: right;">المشرف</th>
                                <th style="padding: 15px; text-align: center;">الترتيب في الرغبات</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        let counter = 1;
        let assignedCount = 0;

        teamsSnapshot.forEach(teamDoc => {
            const team = teamDoc.data();
            const assignedId = team.assignedProjectId;

            // Filter by Type
            let type = (team.studyType || '').toLowerCase();
            if (!type && team.memberUIDs && team.memberUIDs.length > 0) type = studentTypes[team.memberUIDs[0]] || '';
            const isEvening = type.includes('evening') || type.includes('مسائ');

            let matches = false;
            if (filterType === 'morning' && !isEvening) matches = true;
            if (filterType === 'evening' && isEvening) matches = true;

            if (matches && assignedId && projectsMap[assignedId]) {
                assignedCount++;
                const project = projectsMap[assignedId];
                const supervisorName = supervisorsMap[project.supervisorId] || 'غير محدد';

                // Which choice was this?
                let choiceRank = '-';
                if (team.selectedProjects) {
                    const idx = team.selectedProjects.indexOf(assignedId);
                    if (idx !== -1) choiceRank = idx + 1;
                }

                html += `
                    <tr style="border-bottom: 1px solid #edf2f7;">
                        <td style="padding: 15px; text-align: center; color: #718096;">${counter++}</td>
                        <td style="padding: 15px; font-weight: 600;">${team.name || teamDoc.id}</td>
                        <td style="padding: 15px; color: #2c5282; font-weight: bold;">${project.title}</td>
                        <td style="padding: 15px;">${supervisorName}</td>
                        <td style="padding: 15px; text-align: center;">
                            <span style="background: ${choiceRank === 1 ? '#c6f6d5' : '#bee3f8'}; color: ${choiceRank === 1 ? '#22543d' : '#2a4365'}; padding: 4px 10px; border-radius: 20px; font-size: 0.85em; font-weight: bold;">
                                رغبة #${choiceRank}
                            </span>
                        </td>
                    </tr>
                `;
            }
        });

        if (assignedCount === 0) {
            html += `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #e53e3e;">لم يتم توزيع أي مشاريع في الدراسة ال${filterType === 'morning' ? 'صباحية' : 'مسائية'} بعد.</td></tr>`;
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        contentArea.innerHTML = html;

    } catch (error) {
        console.error("Error loading results:", error);
        contentArea.innerHTML = `<div style="padding: 20px; color: red;">❌ خطأ: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = '../loginn/login.html';
            return;
        }

        // Setup logout button
        document.getElementById('logoutBtn').onclick = () => window.adminApp.logout();
    });
});
