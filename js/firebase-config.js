// ============================================
// DXT SPORTS QRO — Firebase Config
// Proyecto: dxt-sports-qro
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyAuBz1xZKFjuQVdga4RoiVsZWOWR80oSws",
  authDomain: "dxt-sports-qro.firebaseapp.com",
  projectId: "dxt-sports-qro",
  storageBucket: "dxt-sports-qro.firebasestorage.app",
  messagingSenderId: "285839494358",
  appId: "1:285839494358:web:290ab53eafc3de542dcd77"
};

firebase.initializeApp(firebaseConfig);

window.db      = firebase.firestore ? firebase.firestore() : null;
window.auth    = firebase.auth ? firebase.auth() : null;
window.storage = firebase.storage ? firebase.storage() : null;
