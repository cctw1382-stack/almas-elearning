import "./style.css";
import { registerOfflineApp } from "./pwa";

const path = location.pathname;
const { VITE_ALMAS_ISSUER: issuer, VITE_ALMAS_CLIENT_ID: clientId } = import.meta.env;
if ((path === '/student/exam' || path === '/auth/callback') && issuer && clientId) {
  void import('./student-exam-page').then(({ mountStudentExam }) => mountStudentExam(
    new URL(issuer),
    clientId,
    new URL(import.meta.env.VITE_ALMAS_API_BASE ?? '/api/v1/', location.origin),
  ));
} else {
  void import('./legacy.js').then(registerOfflineApp);
}
