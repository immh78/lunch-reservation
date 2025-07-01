import { createRouter, createWebHashHistory } from 'vue-router';
import { database, ref as firebaseRef, push } from "../config/firebase";
import { useUserStore } from '../store/user';

import Main from '../pages/Main.vue';

const routes = [
  {
    path: '/',
    name: 'Main',
    component: Main,
    meta: { requiresAuth: true, loggable: true }
  },
  {
    path: '/login',
    name: 'LoginRedirect',
    beforeEnter() {
      window.location.href = 'https://immh78.github.io/tools/#/login';
    },
    meta: { requiresAuth: false, loggable: false }
  }
];

const router = createRouter({
  history: createWebHashHistory('/lunch-reservation/'),
  routes,
});

router.beforeEach((to, from, next) => {
  const userStore = useUserStore();
  const uid = userStore.user?.uid;
  // 로그인 필요
  if (to.meta.requiresAuth && !uid) {
    const fullUrl = window.location.href;
    //return next({ path: '/login', query: { redirect: to.fullPath } });
    window.location.href = `https://immh78.github.io/tools/#/login?redirect=${encodeURIComponent(fullUrl)}`;
    return;
  }

  next(); // 통과
});

/* 1) 공통 날짜·시간 포매터 (Asia/Seoul, YYYYMMDDhhmmss)          */
function formatKST() {
  const kst = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  );
  return (
    kst.getFullYear() +
    String(kst.getMonth() + 1).padStart(2, '0') +
    String(kst.getDate()).padStart(2, '0') +
    String(kst.getHours()).padStart(2, '0') +
    String(kst.getMinutes()).padStart(2, '0') +
    String(kst.getSeconds()).padStart(2, '0')
  );
}

/* 2) afterEach 훅에서 호출될 실제 로깅 함수                       */
async function logPageVisit(route) {
  // (1) 로그 기록이 필요 없는 화면이면 종료
  if (route.meta?.loggable === false) return;

  // (2) 페이지 ID: '/' → root, 그 외엔 마지막 path 세그먼트
  const pageId = 'lunch-reservation';

  // (3) 접속 사용자 UID(없으면 anonymous)
  const userStore = useUserStore();
  const uid = userStore.user?.uid || 'anonymous';

  //console.log("userStore.user", userStore.user)

  // (4) 로그 객체
  const logEntry = {
    datetime: formatKST(),   // YYYYMMDDhhmmss
    uid                     // 사용자 UID
  };

  // (5) Firebase Realtime DB: logs/{pageId}/auto-key
  try {
    const logsRef = firebaseRef(database, `logs/${pageId}`);
    await push(logsRef, logEntry);     // push() → 자동 고유 키 생성
  } catch (err) {
    console.error('Error saving log:', err);
  }
}

router.afterEach((to) => {
  const userStore = useUserStore();
  const uid = userStore.user?.uid;

  //console.log("router.afterEach #1");
  // meta.loggable === true인 페이지만 기록
  if (to.meta?.loggable && uid) {
    // '/'는 실질적으로 대시보드 같은 첫 화면이므로 필요하면 별도 처리
    //console.log("router.afterEach #2");
    logPageVisit(to);
  }
});

export default router;