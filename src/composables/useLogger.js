import { onMounted } from 'vue';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { database, ref, get, set, update } from '../config/firebase';

// 로그를 저장하는 함수
const logPageVisit = async () => {
  // 1. Visitor ID 생성
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  const visitorId = result.visitorId;

  // 2. 현재 페이지의 ID 추출
  const pageId = extractLastPathSegment(window.location.href);

  //console.log('Page ID:', pageId); // 디버깅용 로그

  // 3. 현재 시각
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const datetime = d.getFullYear()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
    + String(d.getHours()).padStart(2, '0')
    + String(d.getMinutes()).padStart(2, '0')
    + String(d.getSeconds()).padStart(2, '0');
    
  // 4. 로그 구조
  const logEntry = { datetime, visitorId };
  const logsRef = ref(database, `logs/${pageId}`);

  try {
    const snapshot = await get(logsRef);
    let existingLogs = [];

    if (snapshot.exists()) {
      existingLogs = snapshot.val();
    }

    existingLogs.push(logEntry);
    await set(logsRef, existingLogs);
  } catch (error) {
    console.error('Error saving log to Firebase:', error);
  }
};

function extractLastPathSegment(url) {
  // URL에서 맨 끝 '/'가 있을 경우 제거
  const trimmedUrl = url.endsWith('/') ? url.slice(0, -1) : url;

  // '/'를 기준으로 분할
  const parts = trimmedUrl.split('/');

  // 마지막 경로 추출
  return parts[parts.length - 1];
}

// Composition API 훅 형태로 내보냄
export const useLogger = () => {
  onMounted(() => {
    logPageVisit();
  });
};
