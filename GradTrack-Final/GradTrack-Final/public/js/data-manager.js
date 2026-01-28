import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    doc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    query,
    where,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- Consts & Helpers ---
const PASS = "123456";
const UNIVERSITY = "جامعة كربلاء";
const COLLEGE = "كلية علوم الحاسوب";

const FIRST_NAMES = ["علي", "محمد", "أحمد", "حسين", "زهراء", "فاطمة", "مريم", "زينب", "يوسف", "حسن", "نور", "سارة"];
const LAST_NAMES = ["الشمري", "الساعدي", "الكعبي", "الخفاجي", "الموسوي", "التميمي", "اللامي", "الزبيدي", "العامري"];

const PROJECT_TITLES = [
    "نظام إدارة المكتبات الذكي", "تطبيق تتبع الباصات", "تحليل مشاعر النصوص العربية",
    "نظام الحضور والغياب بالبصمة", "متجر إلكتروني للمنتجات اليدوية", "نظام أرشفة الوثائق",
    "تطبيق الواقع المعزز للتعليم", "نظام حجز القاعات الدراسية", "منصة تواصل بين الأساتذة والطلاب"
];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateName() {
    return `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)}`;
}

// Generate GPA between 50.00 and 100.00
function generateGPA() {
    return (Math.random() * (100 - 50) + 50).toFixed(2);
}

// Logging to UI
function log(msg, type = 'info') {
    const consoleLogs = document.getElementById('consoleLogs');
    const color = type === 'error' ? 'red' : (type === 'success' ? '#00ff00' : '#00d2d3');
    const line = document.createElement('div');
    line.style.color = color;
    line.innerHTML = `> [${new Date().toLocaleTimeString()}] ${msg}`;
    consoleLogs.appendChild(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Table Rendering
let pendingRows = [];
function addToTable(data) {
    pendingRows.push(data);
    updateTableUI();
}

function updateTableUI() {
    const tbody = document.getElementById('dataTableBody');
    if (pendingRows.length > 0) {
        // Clear "No data" message if it exists
        if (tbody.innerHTML.includes('لا توجد بيانات')) {
            tbody.innerHTML = '';
        }

        // Add pending rows
        pendingRows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.name}</td>
                <td><span style="background:${row.role === 'student' ? '#e1f5fe' : '#fff3e0'}; padding:2px 8px; border-radius:4px;">${row.role === 'student' ? 'طالب' : 'أستاذ'}</span></td>
                <td>${row.dept || '-'}</td>
                <td>${row.gpaOrProjects}</td>
                <td dir="ltr" style="text-align:right">${row.email}</td>
                <td>${row.password}</td>
            `;
            tbody.insertBefore(tr, tbody.firstChild);
        });
        pendingRows = [];
    }
}

// Helper for batch deletion
async function deleteInBatches(querySnapshot, collectionName) {
    const BATCH_SIZE = 400;
    let batch = writeBatch(db);
    let count = 0;
    let totalDeleted = 0;

    for (const document of querySnapshot.docs) {
        batch.delete(document.ref);
        count++;

        if (count >= BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db); // new batch
            totalDeleted += count;
            log(`... تم حذف دفعة (${count}) من ${collectionName}`);
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        totalDeleted += count;
    }
    return totalDeleted;
}

// Helper for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// UI Helper to disable buttons
function setLoading(isLoading) {
    const btns = document.querySelectorAll('button');
    btns.forEach(btn => btn.disabled = isLoading);
    if (isLoading) log('⏳ يرجى الانتظار، العمليات قيد التنفيذ...', 'warning');
}

// --- Core Functions ---

window.generateStudents = async (e) => {
    if (e) e.preventDefault();
    const count = parseInt(document.getElementById('studentCount').value);
    const dept = document.getElementById('studentDept').value;
    const studyType = document.querySelector('input[name="studyType"]:checked').value;

    setLoading(true); // Disable input
    log(`جاري توليد ${count} طلاب في قسم ${dept} (${studyType})...`);

    for (let i = 0; i < count; i++) {
        const name = generateName();
        const gpa = generateGPA();
        // Unique email: student + timestamp + random
        const email = `student${Date.now()}_${Math.floor(Math.random() * 1000)}@uokerbala.edu.iq`;

        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, PASS);
            const user = userCredential.user;

            // 2. Create Firestore Document
            await setDoc(doc(db, "students", user.uid), {
                uid: user.uid,
                fullName: name,
                email: email,
                department: "حاسوب ", // Note the space
                studyType: studyType,
                gpa: parseFloat(gpa),
                university: UNIVERSITY,
                college: "علوم",
                // role field removed
                assignedProjectID: null,
                isLeader: true,
                teamName: null,
                teamCode: null,
                createdAt: serverTimestamp()
            });

            log(`✅ تم إنشاء الطالب: ${name} (${gpa})`, 'success');

            addToTable({
                name: name,
                role: 'student',
                dept: dept,
                gpaOrProjects: gpa,
                email: email,
                password: PASS
            });

        } catch (error) {
            log(`❌ خطأ في إنشاء الطالب: ${error.message}`, 'error');
        }
        await delay(1500); // Increased throttle to 1.5s
    }
    log(`✨ تم الانتهاء من توليد الطلاب.`);
    setLoading(false); // Enable input
};

window.generateProfessors = async () => {
    const count = parseInt(document.getElementById('profCount').value);
    setLoading(true);
    log(`جاري توليد ${count} أساتذة مع مشاريعهم...`);

    for (let i = 0; i < count; i++) {
        const name = generateName();
        // Supervisor dept can be fixed or random. Using CS as base.
        const dept = "علوم حاسوب";
        const email = `dr.test${Date.now()}_${Math.floor(Math.random() * 1000)}@uokerbala.edu.iq`;

        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, PASS);
            const user = userCredential.user;

            // 2. Create Supervisor Doc
            await setDoc(doc(db, "supervisors", user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                department: dept,
                university: UNIVERSITY,
                college: COLLEGE,
                role: "supervisor",
                projectsCount: 0
            });

            // 3. Generate Projects
            const projectCount = Math.floor(Math.random() * 3) + 3; // 3 to 5
            for (let j = 0; j < projectCount; j++) {
                const projectRef = doc(collection(db, "projects"));
                await setDoc(projectRef, {
                    projectId: projectRef.id,
                    title: `${getRandomItem(PROJECT_TITLES)} - ${Math.floor(Math.random() * 99)}`,
                    description: "وصف تجريبي للمشروع تم توليده تلقائياً لأغراض الاختبار.",
                    supervisorId: user.uid,
                    supervisorName: name,
                    department: dept,
                    studyType: Math.random() > 0.5 ? "صباحية" : "مسائية",
                    status: "available",
                    createdAt: new Date().toISOString()
                });
            }

            log(`✅ تم إنشاء الأستاذ: ${name} مع ${projectCount} مشاريع`, 'success');

            addToTable({
                name: name,
                role: 'supervisor',
                dept: dept,
                gpaOrProjects: `${projectCount} مشاريع`,
                email: email,
                password: PASS
            });

        } catch (error) {
            log(`❌ خطأ في إنشاء الأستاذ: ${error.message}`, 'error');
        }
        await delay(1500); // Increased throttle to 1.5s
    }
    log(`✨ تم الانتهاء من توليد الأساتذة.`);
    setLoading(false);
};

// --- Teams & Projects ---

window.generateTeams = async () => {
    setLoading(true);
    const teamSize = parseInt(document.getElementById('teamSize').value);
    const studyType = document.querySelector('input[name="teamStudyType"]:checked').value;

    log(`👥 جاري تكوين فرق (حجم ${teamSize}) للطلاب (${studyType})...`);

    try {
        // 1. Get Students without Team
        const studentsRef = collection(db, "students");
        const q = query(studentsRef, where("studyType", "==", studyType));
        const snapshot = await getDocs(q);

        // Filter purely in JS to be safe about "teamCode" field existence
        const availableStudents = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.teamCode) availableStudents.push({ id: doc.id, ...data });
        });

        if (availableStudents.length === 0) {
            log('⚠️ لا يوجد طلاب متاحين (بدون فريق) لهذا النوع.', 'warning');
            setLoading(false);
            return;
        }

        // 2. Chunking
        const teams = [];
        while (availableStudents.length > 0) {
            teams.push(availableStudents.splice(0, teamSize));
        }

        // 3. Create Teams
        let createdCount = 0;
        const batchSize = 100; // conservative batch

        // Process chunks of teams to avoid massive batch ops
        for (let i = 0; i < teams.length; i++) {
            const teamMembers = teams[i];
            if (teamMembers.length === 0) continue;

            // Generate Team ID
            const teamCode = `TEAM_${Date.now()}_${i}`;
            const teamName = `فريق ${generateName().split(' ')[0]} ${Math.floor(Math.random() * 100)}`; // Random name

            const teamRef = doc(collection(db, "teams"), teamCode); // Use teamCode as Doc ID
            const memberUIDs = teamMembers.map(s => s.id);
            const memberNames = teamMembers.map(s => s.fullName); // Use fullName

            // Using batch for atomic team+members update
            const batch = writeBatch(db);

            // Create Team Doc
            batch.set(teamRef, {
                teamCode: teamCode,
                teamName: teamName,
                memberUIDs: memberUIDs,
                memberUsernames: memberNames, // Store names too
                studyType: studyType,
                createdAt: new Date().toISOString(),
                status: 'pending' // pending project assignment
            });

            // Update Members
            teamMembers.forEach((s, index) => {
                const sRef = doc(db, "students", s.id);
                batch.update(sRef, {
                    teamCode: teamCode,
                    teamName: teamName,
                    isLeader: index === 0
                });
            });

            await batch.commit();
            createdCount++;

            addToTable({
                name: teamName,
                role: 'Team',
                dept: studyType,
                gpaOrProjects: `${memberUIDs.length} أعضاء`,
                email: memberNames.join(', '),
                password: 'N/A'
            });

            await delay(200); // slight throttle
        }

        log(`✅ تم إنشاء ${createdCount} فريق بنجاح.`, 'success');

    } catch (e) {
        log(`❌ خطأ في تكوين الفرق: ${e.message}`, 'error');
    }
    setLoading(false);
};

window.generateSelections = async () => {
    setLoading(true);
    const studyType = document.querySelector('input[name="teamStudyType"]:checked').value;
    log(`⚡ جاري توليد رغبات (Selections) لفرق (${studyType})...`);

    try {
        // 1. Fetch Available Projects
        const projRef = collection(db, "projects");
        const projectsQ = query(projRef, where("status", "==", "available"), where("studyType", "==", studyType));
        const projSnap = await getDocs(projectsQ);

        let availableProjects = [];
        projSnap.forEach(d => availableProjects.push({ id: d.id, ...d.data() }));

        if (availableProjects.length < 3) {
            // Allow if at least 1 exist used for testing, but warn
            log(`⚠️ عدد المشاريع المتاحة قليل جداً (${availableProjects.length}).`, 'warning');
        }

        // 2. Fetch Teams
        const teamsRef = collection(db, "teams");
        const teamsQ = query(teamsRef, where("studyType", "==", studyType));
        const teamsSnap = await getDocs(teamsQ);

        let targetTeams = [];
        teamsSnap.forEach(d => {
            targetTeams.push({ id: d.id, ...d.data() });
        });

        if (targetTeams.length === 0) {
            log(`⚠️ لا توجد فرق مسجلة.`, 'warning');
            setLoading(false);
            return;
        }

        // 3. Generate Selections
        let updatedCount = 0;

        for (const team of targetTeams) {
            if (availableProjects.length === 0) break;

            // Pick 3 random distinct projects
            const shuffled = [...availableProjects].sort(() => Math.random() - 0.5);
            const selections = shuffled.slice(0, 3).map(p => p.id);
            const selectionTitles = shuffled.slice(0, 3).map(p => p.title);

            const batch = writeBatch(db);

            batch.update(doc(db, "teams", team.id), {
                selectedProjects: selections,
                lastUpdated: serverTimestamp()
            });

            await batch.commit();
            updatedCount++;

            log(`📝 ${team.teamName} اختار: ${selectionTitles.join(' | ')}`);
            await delay(100);
        }

        log(`✅ تم توليد رغبات لـ ${updatedCount} فريق.`, 'success');

    } catch (e) {
        log(`❌ خطأ في توليد الرغبات: ${e.message}`, 'error');
    }
    setLoading(false);
};

// --- Cleaning Functions ---

window.clearStudents = async () => {
    if (!confirm("هل أنت متأكد؟ سيتم حذف جميع الطلاب ومستنداتهم! \n⚠️ سيتم أيضاً حذف جميع الفرق (Teams) لضمان عدم وجود بيانات يتيمة.")) return;

    log(`⚠️ جاري حذف الطلاب والفرق...`);
    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const teamsSnapshot = await getDocs(collection(db, "teams"));

        const studentsDeleted = await deleteInBatches(studentsSnapshot, "الطلاب");
        const teamsDeleted = await deleteInBatches(teamsSnapshot, "الفرق");

        if (studentsDeleted > 0 || teamsDeleted > 0) {
            log(`✅ تم حذف ${studentsDeleted} طالب و ${teamsDeleted} فريق.`, 'success');
        } else {
            log(`لا توجد بيانات للحذف.`);
        }

    } catch (error) {
        log(`❌ خطأ في الحذف: ${error.message}`, 'error');
    }
};

window.clearProfessors = async () => {
    if (!confirm("تحذير: هذا سيحذف جميع الأساتذة وكل المشاريع المرتبطة بهم (Cascade Delete). هل أنت متأكد؟")) return;

    log(`⚠️ جاري حذف الأساتذة ومشاريعهم...`);
    try {
        const supervisorsSnapshot = await getDocs(collection(db, "supervisors"));
        const projectsSnapshot = await getDocs(collection(db, "projects"));

        // 1. Delete Supervisors
        const supervisorsDeleted = await deleteInBatches(supervisorsSnapshot, "الأساتذة");

        // 2. Cascade Delete Projects
        const supervisorIds = new Set(supervisorsSnapshot.docs.map(d => d.id));

        let batch = writeBatch(db);
        let pCount = 0;
        let pTotal = 0;

        for (const doc of projectsSnapshot.docs) {
            const data = doc.data();
            if (data.supervisorId && supervisorIds.has(data.supervisorId)) {
                batch.delete(doc.ref);
                pCount++;
                if (pCount >= 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    pTotal += pCount;
                    pCount = 0;
                }
            }
        }
        if (pCount > 0) {
            await batch.commit();
            pTotal += pCount;
        }

        if (supervisorsDeleted > 0 || pTotal > 0) {
            log(`✅ تم حذف ${supervisorsDeleted} أستاذ و ${pTotal} مشروع مرتبط.`, 'success');
        } else {
            log(`لا توجد بيانات للحذف.`);
        }

    } catch (error) {
        log(`❌ خطأ في الحذف: ${error.message}`, 'error');
    }
};

// Bind too form
document.addEventListener('DOMContentLoaded', () => {
    const studentForm = document.getElementById('studentGenForm');
    if (studentForm) studentForm.addEventListener('submit', window.generateStudents);
});

//نسخة 6 بارت 02