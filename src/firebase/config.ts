import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyACAkED__ibIPgCdWvCgBjutAGs2hJbsPk",
  authDomain: "gym-buddy-bbe4e.firebaseapp.com",
  projectId: "gym-buddy-bbe4e",
  storageBucket: "gym-buddy-bbe4e.firebasestorage.app",
  messagingSenderId: "607525329707",
  appId: "1:607525329707:web:b0155d84f3221b2d03836e"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();