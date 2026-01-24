import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const submitBtn = document.getElementById('submitProjectsBtn');
const availableZone = document.getElementById('available-projects');
const chosenZone = document.getElementById('chosen-projects');
const draggables = document.querySelectorAll('.draggable');
const navProjects = document.getElementById('nav-projects');
const section = document.getElementById('projects-section');

let currentUser = null;
let teamCode = null;
let isLeader = false;

// Auth check (simple again to ensure we have context)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const snap = await getDoc(doc(db, "students", user.uid));
        if (snap.exists()) {
            const data = snap.data();
            teamCode = data.teamCode;
            isLeader = data.isLeader;

            if (isLeader && teamCode) {
                // Allow access
                if (navProjects) navProjects.style.display = 'block';
            } else {
                // Hide project selection link/access if not leader
                if (navProjects) navProjects.style.display = 'none';
            }
        }
    }
});

// Drag and Drop Logic
draggables.forEach(draggable => {
    draggable.addEventListener('dragstart', () => {
        draggable.classList.add('dragging');
    });

    draggable.addEventListener('dragend', () => {
        draggable.classList.remove('dragging');
    });
});

[availableZone, chosenZone].forEach(zone => {
    if (!zone) return;

    zone.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(zone, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            zone.appendChild(draggable);
        } else {
            zone.insertBefore(draggable, afterElement);
        }
    });
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Styles for draggables (Inject dynamically or rely on css)
const style = document.createElement('style');
style.innerHTML = `
    .draggable {
        padding: 10px;
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-bottom: 5px;
        cursor: move;
    }
    .draggable.dragging {
        opacity: 0.5;
        background-color: var(--secondary-color);
        color: white;
    }
`;
document.head.appendChild(style);


// Submit Logic
if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        if (!isLeader) {
            alert("فقط قائد الفريق يمكنه تسليم الرغبات.");
            return;
        }
        if (!teamCode) {
            alert("ليس لديك فريق.");
            return;
        }

        const chosenElements = chosenZone.querySelectorAll('.draggable');
        if (chosenElements.length === 0) {
            alert("يرجى اختيار مشروع واحد على الأقل.");
            return;
        }

        const chosenProjectIDs = Array.from(chosenElements).map(el => el.getAttribute('data-id'));

        try {
            await updateDoc(doc(db, "teams", teamCode), {
                chosenProjects: chosenProjectIDs,
                mufadalaTimestamp: new Date()
            });
            alert("تم حفظ الرغبات بنجاح!");
        } catch (error) {
            console.error("Save Projects Error", error);
            alert("حدث خطأ أثناء الحفظ.");
        }
    });
}

// Navigation Logic (Simple listener binding)
if (navProjects) {
    navProjects.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.main-content > div').forEach(div => div.classList.add('hidden'));
        section.classList.remove('hidden');
    });
}
