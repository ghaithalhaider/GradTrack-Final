import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// DOM Elements
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('error-message');

function showError(msg) {
    if (errorMessage) {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
    } else {
        alert(msg);
    }
}

// REGISTER FLOW
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username')?.value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const department = document.getElementById('department')?.value;

        try {
            // 1. Create User in Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Send Email Verification
            await sendEmailVerification(user);
            console.log("Verification email sent");

            // 3. Create User Document in Firestore (students collection)
            // Schema: students: {uid, username, email, gpa, department, teamCode, isLeader}
            // Note: GPA is secret/admin-set, so initially null or 0.
            await setDoc(doc(db, "students", user.uid), {
                uid: user.uid,
                username: username,
                email: email,
                department: department,
                teamCode: null, // No team yet
                isLeader: false,
                gpa: null, // To be set by Admin
                role: 'student' // Explicit role field helping with RLS or UI logic
            });

            alert('تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني قبل تسجيل الدخول.');
            window.location.href = 'login.html';

        } catch (error) {
            console.error("Registration Error", error);
            showError(error.message);
        }
    });
}

// LOGIN FLOW
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                showError('يرجى تأكيد بريدك الإلكتروني أولاً.');
                // Optional: Allow logging in but restrict access, or force logout.
                // For this project, we might want to notify them.
                // await signOut(auth); 
                // return;
            }

            // Check Role/Redirect
            // Fetch user doc to see role or just go to dashboard
            const studentDoc = await getDoc(doc(db, "students", user.uid));

            if (studentDoc.exists()) {
                console.log("Student logged in:", studentDoc.data());
                window.location.href = 'index.html'; // Or dashboard
            } else {
                // Could be admin or supervisor (handled differently or different collection)
                // For simplicity, checking if maybe in a 'users' collection or similar.
                // Assuming Admin/Supervisor are pre-seeded or separate logic for now, 
                // but if they try to login here, we just redirect to home.
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error("Login Error", error);
            showError("فشل تسجيل الدخول: " + error.message);
        }
    });
}

// LOGOUT UTILITY (Global)
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Logout Error", error);
    }
};
