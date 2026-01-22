// Firebase Config
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKM4ZYHYnko97QykRhdzPvYQOKqZHBc_E",
    authDomain: "gradtracksystem.firebaseapp.com",
    projectId: "gradtracksystem",
    storageBucket: "gradtracksystem.firebasestorage.app",
    messagingSenderId: "370902148558",
    appId: "1:370902148558:web:4e883764f7a7c1bb15379f"
};

let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Firebase تم تهيئته بنجاح");
} catch (error) {
    console.error("❌ خطأ في تهيئة Firebase:", error);
    // Show user-friendly error message
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: Arial;">
            <div style="background: white; padding: 40px; border-radius: 15px; max-width: 500px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                <h1 style="color: #333; margin: 0 0 10px 0;">مشكلة في الاتصال</h1>
                <p style="color: #666; font-size: 1.1em; margin: 0 0 20px 0;">
                    نعتذر عن عدم القدرة على الاتصال بـ Firebase. قد تكون هناك مشكلة في:
                </p>
                <ul style="color: #666; text-align: right; line-height: 1.8;">
                    <li>❌ الإنترنت غير متصل</li>
                    <li>❌ بيانات اعتماد Firebase غير صحيحة</li>
                    <li>❌ خادم Firebase غير متاح</li>
                </ul>
                <button onclick="location.reload()" style="background: #667eea; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 1em; cursor: pointer; font-weight: bold; margin-top: 20px;">
                    🔄 إعادة المحاولة
                </button>
            </div>
        </div>
    `;
}

// Connect to Emulators if running locally (disabled by default)
if (location.hostname === "localhost" && app) {
    // Uncomment to enable emulators for testing:
    // connectAuthEmulator(auth, "http://localhost:9099");
    // connectFirestoreEmulator(db, 'localhost', 8080);
}

export { app, auth, db };
