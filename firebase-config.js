const firebaseConfig = {
  apiKey: "AIzaSyCDgqdxsMdS6WViO09XDLvkIc3315bvBr0",
  authDomain: "statvision-consultancy.firebaseapp.com",
  projectId: "statvision-consultancy",
  storageBucket: "statvision-consultancy.firebasestorage.app",
  messagingSenderId: "1017621661170",
  appId: "1:1017621661170:web:00e7cf7481b4439f21976b"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDB = firebase.firestore();
const fbStorage = firebase.storage();