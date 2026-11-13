import "./style.css";
import { registerOfflineApp } from "./pwa";

const path = location.pathname;
const { VITE_ALMAS_ISSUER: issuer, VITE_ALMAS_CLIENT_ID: clientId } = import.meta.env;
if ((path === '/student/exam' || path === '/student/video' || path === '/auth/callback') && issuer && clientId) {
  const video = path === '/student/video' ||
    (path === '/auth/callback' && sessionStorage.getItem('almas:student-video:return') !== null);
  if (video) {
    void import('./student-video-page').then(({ mountStudentVideo }) => mountStudentVideo(
      new URL(issuer), clientId, new URL(import.meta.env.VITE_ALMAS_API_BASE ?? '/api/v1/', location.origin),
    ));
  } else {
    void import('./student-exam-page').then(({ mountStudentExam }) => mountStudentExam(
      new URL(issuer), clientId, new URL(import.meta.env.VITE_ALMAS_API_BASE ?? '/api/v1/', location.origin),
    ));
  }
} else {
  void import('./legacy.js').then(registerOfflineApp);
}
