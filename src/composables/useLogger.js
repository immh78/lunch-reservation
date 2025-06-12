import { onMounted } from 'vue';
import { database, ref, get, update } from '../config/firebase';
import { useUserStore } from '../store/user';

// 로그를 저장하는 함수
const logPageVisit = async () => {
  // 2. 현재 페이지의 ID 추출
  let pageId = extractLastPathSegment(window.location.href);
  pageId = pageId === "#" ? "lunch-reservation" : pageId;
  console.log('Page ID:', pageId); // 디버깅용 로그

  // 3. 현재 시각
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const datetime = d.getFullYear()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
    + String(d.getHours()).padStart(2, '0')
    + String(d.getMinutes()).padStart(2, '0')
    + String(d.getSeconds()).padStart(2, '0');

  // 4. 로그 구조
  const userStore = useUserStore();
  const uid = userStore.user.uid||'anonymous'; // 로그인하지 않은 경우 'anonymous'로 설정
 
  const logEntry = { datetime, uid };
  const logsRef = ref(database, `logs/${pageId}`);

  try {
    const snapshot = await get(logsRef);

    let existingLogs = [];
    let key = 0;

    if (snapshot.exists()) {
      existingLogs = snapshot.val();
      const LogKeys = Object.keys(existingLogs).map(Number); // 문자열이 아닌 숫자로 변환
      // 0부터 순차적으로 증가하며 비어있는 값을 찾기
      while (LogKeys.includes(key)) {
        key++;
      }
    } else {
      key = 0;
    }

    const inputLog = {
      [key]: logEntry
    }
    await update(logsRef, inputLog);

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
