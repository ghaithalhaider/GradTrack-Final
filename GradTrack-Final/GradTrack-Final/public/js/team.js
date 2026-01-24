import { db, auth } from './firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// DOM Elements
const createTeamForm = document.getElementById('createTeamForm');
const joinTeamForm = document.getElementById('joinTeamForm');

// State
let currentUser = null;
let currentStudentDoc = null;

// Initialize
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Fetch Student Data
        const snap = await getDoc(doc(db, "students", user.uid));
        if (snap.exists()) {
            currentStudentDoc = snap.data();
            initTeamUI();
        }
    }
});

async function initTeamUI() {
    // Check if student has a team
    if (currentStudentDoc.teamCode) {
        showMyTeam(currentStudentDoc.teamCode);
    } else {
        showNoTeam();
    }
}

function showNoTeam() {
    document.getElementById('no-team-section').classList.remove('hidden');
    document.getElementById('my-team-section').classList.add('hidden');
}

async function showMyTeam(teamCode) {
    document.getElementById('no-team-section').classList.add('hidden');
    document.getElementById('my-team-section').classList.remove('hidden');

    // Fetch Team Data
    const teamSnap = await getDoc(doc(db, "teams", teamCode));
    if (teamSnap.exists()) {
        const teamData = teamSnap.data();
        document.getElementById('displayTeamName').textContent = teamData.teamName;
        document.getElementById('displayTeamCode').textContent = teamData.teamCode;
        document.getElementById('displayHighestGPA').textContent = teamData.highestGPA || "0.0";

        // Fetch Members
        const q = query(collection(db, "students"), where("teamCode", "==", teamCode));
        const querySnapshot = await getDocs(q);
        const list = document.getElementById('teamMembersList');
        list.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const member = doc.data();
            const li = document.createElement('li');
            li.style.padding = '1rem';
            li.style.borderBottom = '1px solid #eee';
            li.innerHTML = `
                <strong>${member.username}</strong> 
                ${member.isLeader ? '<span style="color:var(--primary-color)">(قائد)</span>' : ''}
            `;
            list.appendChild(li);
        });
    }
}

// Logic: Create Team
if (createTeamForm) {
    createTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const teamName = document.getElementById('newTeamName').value;
        const generatedCode = 'TEAM-' + Math.random().toString(36).substr(2, 6).toUpperCase();

        try {
            // 1. Create Team Doc
            // Schema: teams: {teamCode, teamName, leaderUID, highestGPA, chosenProjects[], isLocked}
            const teamData = {
                teamCode: generatedCode,
                teamName: teamName,
                leaderUID: currentUser.uid,
                highestGPA: currentStudentDoc.gpa || 0, // Initialize with Leader's GPA
                chosenProjects: [],
                isLocked: false,
                memberCount: 1
            };

            await setDoc(doc(db, "teams", generatedCode), teamData);

            // 2. Update Student Doc (Leader)
            await updateDoc(doc(db, "students", currentUser.uid), {
                teamCode: generatedCode,
                isLeader: true
            });

            alert(`تم إنشاء الفريق بنجاح! رمز الفريق: ${generatedCode}`);
            window.location.reload(); // Reload to refresh UI

        } catch (error) {
            console.error("Create Team Error", error);
            alert("حدث خطأ أثناء إنشاء الفريق.");
        }
    });
}

// Logic: Join Team
if (joinTeamForm) {
    joinTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('teamCodeInput').value.trim();

        try {
            const teamRef = doc(db, "teams", code);
            const teamSnap = await getDoc(teamRef);

            if (!teamSnap.exists()) {
                alert("رمز الفريق غير صحيح.");
                return;
            }

            const teamData = teamSnap.data();

            if (teamData.memberCount >= 4) {
                alert("الفريق مكتمل (الحد الأقصى 4).");
                return;
            }

            // JOINLOGIC: Update Student
            await updateDoc(doc(db, "students", currentUser.uid), {
                teamCode: code,
                isLeader: false
            });

            // JOINLOGIC: Update Team (Member Count & Highest GPA)
            const myGPA = currentStudentDoc.gpa || 0;
            const newHighest = Math.max(teamData.highestGPA || 0, myGPA);

            await updateDoc(teamRef, {
                // primitive increment not always safe without transactions, but ok for prototype
                // using arrayUnion for members if I tracked them there, but I track in 'students'
                // just manually increment count
                memberCount: teamData.memberCount + 1,
                highestGPA: newHighest
            });

            alert("تم الانضمام للفريق بنجاح!");
            window.location.reload();

        } catch (error) {
            console.error("Join Team Error", error);
            alert("حدث خطأ أثناء الانضمام للفريق.");
        }
    });
}
