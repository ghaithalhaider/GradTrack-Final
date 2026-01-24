// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKM4ZYHYnko97QykRhdzPvYQOKqZHBc_E",
  authDomain: "gradtracksystem.firebaseapp.com",
  projectId: "gradtracksystem",
  storageBucket: "gradtracksystem.firebasestorage.app",
  messagingSenderId: "370902148558",
  appId: "1:370902148558:web:4e883764f7a7c1bb15379f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Connect to Emulators if running locally
if (window.location.hostname === "localhost") {
  console.log("Running on localhost, connecting to Firebase Emulators...");
  
  // Auth Emulator
  connectAuthEmulator(auth, "http://localhost:9099");
  
  // Firestore Emulator
  connectFirestoreEmulator(db, 'localhost', 8080);
  
  // Functions Emulator
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export { app, auth, db, functions };