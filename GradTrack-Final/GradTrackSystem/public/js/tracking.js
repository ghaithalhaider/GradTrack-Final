import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    getDoc,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const assignTaskForm = document.getElementById('assignTaskForm');
const tasksListContainer = document.getElementById('tasks-list');
const supervisorControls = document.getElementById('supervisor-controls');
const theoryBar = document.getElementById('theory-bar');
const practicalBar = document.getElementById('practical-bar');
const navHome = document.getElementById('nav-home');
// Assuming navHome takes us to main dashboard where we might link to tracking, 
// OR we just auto-show tracking if relevant. For now, let's auto-init if in tracking mode.

let currentUser = null;
let userRole = null; // 'student' or 'supervisor'
let teamCode = null;

// Initial Auth & Data Fetch
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Ideally we check if user is in 'students' or 'supervisors' collection
        // For prototype, if not in 'students', assume 'supervisor' or 'admin' 
        // OR rely on a field in student doc.

        try {
            const studentSnap = await getDoc(doc(db, "students", user.uid));
            if (studentSnap.exists()) {
                const data = studentSnap.data();
                userRole = 'student';
                teamCode = data.teamCode;
                // Since this is a SPA, we might want to trigger tracking view updates if visible
                if (teamCode) {
                    loadTasks(teamCode);
                    calculateProgress(teamCode);
                    // Add a nav link for tracking dynamically? 
                    // For now, let's assume the user navigates there or it's part of the main dash
                    // Adding a link to Sidebar
                    addTrackingNavLink();
                }
            } else {
                // Assume Supervisor/Admin for prototype
                userRole = 'supervisor';
                supervisorControls.classList.remove('hidden');
                // Supervisor needs to pick a team. For simplicity, let's hardcode or 
                // pick the first team found? Or just let them Create Tasks for *a* team they manage.
                // NOTE: User Request said "Supervisor sends task". 
                // We need a mechanism to pick a team.
                // Simplifying: Supervisor manages ONE team or we prompt for Team Code.
                // Let's Add an input for "Target Team Code" in the Supervisor Form.
                addTeamInputToSupervisorForm();
                addTrackingNavLink();
            }
        } catch (e) {
            console.error("User Load Error", e);
        }
    }
});

function addTrackingNavLink() {
    const sidebarList = document.querySelector('#sidebar ul');
    if (!document.getElementById('nav-tracking')) {
        const li = document.createElement('li');
        li.style.marginBottom = '1rem';
        li.innerHTML = '<a href="#" id="nav-tracking" style="color:white;">متابعة التقدم</a>';
        sidebarList.insertBefore(li, sidebarList.lastElementChild); // Before Logout

        li.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.main-content > div').forEach(div => div.classList.add('hidden'));
            document.getElementById('tracking-section').classList.remove('hidden');
        });
    }
}

function addTeamInputToSupervisorForm() {
    // Inject input into form if not exists
    if (!document.getElementById('targetTeamCode')) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = '<label>رمز الفريق المستهدف</label><input type="text" id="targetTeamCode" required>';
        assignTaskForm.insertBefore(div, assignTaskForm.firstChild);
    }
}

// Supervisor: Assign Task
if (assignTaskForm) {
    assignTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (userRole !== 'supervisor') return;

        const title = document.getElementById('taskTitle').value;
        const type = document.getElementById('taskType').value;
        // If supervisor, get target team
        const targetTeam = document.getElementById('targetTeamCode').value.trim();

        try {
            await addDoc(collection(db, "tasks"), {
                teamCode: targetTeam,
                title: title,
                type: type, // theory or practical
                status: 'pending', // pending -> submitted -> accepted
                fileURL: null,
                timestamp: new Date()
            });
            alert('تم إرسال المهمة بنجاح');
            // Reload tasks if we are viewing that team
            loadTasks(targetTeam);
            // assignTaskForm.reset();
        } catch (error) {
            console.error("Assign Task Error", error);
            alert("فشل الإرسال");
        }
    });
}

// Load Tasks
function loadTasks(tCode) {
    if (!tCode) return;

    // Realtime listener
    const q = query(collection(db, "tasks"), where("teamCode", "==", tCode), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        tasksListContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            const taskId = docSnap.id;

            const card = document.createElement('div');
            card.style.background = 'white';
            card.style.padding = '1rem';
            card.style.borderRadius = '8px';
            card.style.border = '1px solid #ddd';

            let statusBadge = '';
            if (task.status === 'pending') statusBadge = '<span style="color:orange">قيد الانتظار</span>';
            else if (task.status === 'submitted') statusBadge = '<span style="color:blue">تم التسليم - بانتظار الموافقة</span>';
            else if (task.status === 'accepted') statusBadge = '<span style="color:green">مقبولة (تم تحديث التقدم)</span>';

            let actionArea = '';

            // Student Action: Upload
            if (userRole === 'student' && task.status === 'pending') {
                actionArea = `
                    <div style="margin-top:0.5rem">
                        <input type="text" id="file-${taskId}" placeholder="رابط الملف/الحل..." style="width:70%; padding:5px;">
                        <button onclick="window.submitTask('${taskId}')" class="btn-primary" style="width:auto; padding:5px 10px;">تسليم</button>
                    </div>
                 `;
            }
            // Supervisor Action: Accept
            else if (userRole === 'supervisor' && task.status === 'submitted') {
                actionArea = `
                   <div style="margin-top:0.5rem">
                        <p>ملف الطالب: <a href="${task.fileURL}" target="_blank">عرض الحل</a></p>
                        <button onclick="window.acceptTask('${taskId}', '${task.type}', '${task.teamCode}')" class="btn-primary" style="background:green; width:auto; padding:5px 10px;">قبول واعتماد النسبة</button>
                    </div> 
                `;
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <h4>${task.title} (${task.type === 'theory' ? 'نظري' : 'عملي'})</h4>
                    <div>${statusBadge}</div>
                </div>
                ${actionArea}
            `;
            tasksListContainer.appendChild(card);
        });

        // Recalculate progress on any change
        calculateProgress(tCode);
    });
}

// Global Functions for inline onclicks
window.submitTask = async (taskId) => {
    const fileInput = document.getElementById(`file-${taskId}`);
    const url = fileInput.value;
    if (!url) { alert("أدخل الرابط أولاً"); return; }

    try {
        await updateDoc(doc(db, "tasks", taskId), {
            status: 'submitted',
            fileURL: url
        });
        alert('تم تسليم الحل.');
    } catch (e) {
        console.error(e);
        alert('حدث خطأ');
    }
};

window.acceptTask = async (taskId, type, tCode) => {
    try {
        await updateDoc(doc(db, "tasks", taskId), {
            status: 'accepted'
        });
        alert('تم قبول المهمة وتحديث النسبة.');
        // Progress calc happens automatically via the snapshot listener which calls calculateProgress
    } catch (e) {
        console.error(e);
        alert('حدث خطأ');
    }
};

async function calculateProgress(tCode) {
    // 50% Theory | 50% Practical
    // Weight = 50 / total tasks of that type

    const q = query(collection(db, "tasks"), where("teamCode", "==", tCode));
    const snap = await getDocs(q);

    let totalTheory = 0;
    let acceptedTheory = 0;
    let totalPractical = 0;
    let acceptedPractical = 0;

    snap.forEach(d => {
        const t = d.data();
        if (t.type === 'theory') {
            totalTheory++;
            if (t.status === 'accepted') acceptedTheory++;
        } else {
            totalPractical++;
            if (t.status === 'accepted') acceptedPractical++;
        }
    });

    const theoryProgress = totalTheory === 0 ? 0 : (acceptedTheory / totalTheory) * 50;
    const practicalProgress = totalPractical === 0 ? 0 : (acceptedPractical / totalPractical) * 50;

    // Update bars
    // Using % of the 50% max width effectively? 
    // Wait, the UI bars are separate. 
    // Theory Bar: Full width = 50% of total grade? Or Full Width = 100% of Theory tasks?
    // "Theory (50%)" label implies the bar represents the 50 points.
    // So if I have done 1/2 theory tasks, I have 25 points.
    // The bar should probably fill based on (accepted / total). 
    // If I used (accepted/total * 100)%, the bar fills up. The LABEL says "Theory (50%)" meaning the max worth is 50%.

    const theoryPerc = totalTheory === 0 ? 0 : (acceptedTheory / totalTheory) * 100;
    const practicalPerc = totalPractical === 0 ? 0 : (acceptedPractical / totalPractical) * 100;

    if (theoryBar) theoryBar.style.width = `${theoryPerc}%`;
    if (practicalBar) practicalBar.style.width = `${practicalPerc}%`;
}
