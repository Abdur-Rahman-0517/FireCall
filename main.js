// Firebase import and config
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Firebase project config (firecall-ar)
const firebaseConfig = {
  apiKey: "AIzaSyC7h5yMLgLNLkjPXdALhwFga9omSXLCPZk",
  authDomain: "firecall-ar.firebaseapp.com",
  projectId: "firecall-ar",
  storageBucket: "firecall-ar.firebasestorage.app",
  messagingSenderId: "656564158162",
  appId: "1:656564158162:web:6a9b6efc5f02f58eb8370b"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// WebRTC peer connection
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

let localStream = new MediaStream();
let remoteStream = new MediaStream();
document.getElementById("localVideo").srcObject = localStream;
document.getElementById("remoteVideo").srcObject = remoteStream;

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
    localStream.addTrack(track);
  });
});

pc.ontrack = (event) => {
  event.streams[0].getTracks().forEach(track => {
    remoteStream.addTrack(track);
  });
};

let roomRef;

window.startCall = async () => {
  roomRef = doc(collection(db, "rooms"));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await setDoc(roomRef, {
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  });

  pc.onicecandidate = event => {
    if (event.candidate) {
      addDoc(collection(roomRef, "callerCandidates"), event.candidate.toJSON());
    }
  };

  onSnapshot(roomRef, async (snapshot) => {
    const data = snapshot.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  onSnapshot(collection(roomRef, "calleeCandidates"), snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  alert("🔗 Room ID: " + roomRef.id);
};

window.joinCall = async () => {
  const roomId = prompt("Enter Room ID:");
  roomRef = doc(db, "rooms", roomId);
  const roomSnapshot = await getDoc(roomRef);

  const offer = roomSnapshot.data().offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await setDoc(roomRef, {
    answer: {
      type: answer.type,
      sdp: answer.sdp
    }
  }, { merge: true });

  pc.onicecandidate = event => {
    if (event.candidate) {
      addDoc(collection(roomRef, "calleeCandidates"), event.candidate.toJSON());
    }
  };

  onSnapshot(collection(roomRef, "callerCandidates"), snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
};
