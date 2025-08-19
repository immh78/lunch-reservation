<script setup>
import { ref, onMounted, computed } from 'vue';
import { useDisplay } from 'vuetify';
import { useUserStore } from '../store/user';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { database, ref as firebaseRef, get, set, update, remove } from "../config/firebase";
import { useRouter } from 'vue-router';
import { Cloudinary } from '@cloudinary/url-gen'
import { AdvancedImage, responsive, placeholder } from '@cloudinary/vue'

/* Cloudinary 설정 */
const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const lastPublicId = ref('');
const cld = new Cloudinary({ cloud: { cloudName } });
const preview = ref(null);

let widget;
//------------------------------------------------

const userStore = useUserStore();
const router = useRouter();

const { mdAndDown } = useDisplay();  // md 이하 (xs, sm, md) → 모바일
const isMobile = mdAndDown;         // 그대로 사용하면 됨

const restaurant = ref([]);
const restaurantData = ref({});
const restaurantInfo = ref({});
const reservation = ref([]);
const isResvPopup = ref(false);
const resvPopupData = ref({});
const blockRestaurant = ref([]);
const resvPopupRef = ref({});
const prepayment = ref({});
const prepayPopupData = ref([]);

const isListPopup = ref(false);
const listPopupTitle = ref('');
const listPopupSelectable = ref(false);
const listPopupData = ref([]);
const uid = ref("");
const sumCost = ref(0);

const isLoading = ref(false);
const isRestaurantPopup = ref(false);
const isRestaurantAdd = ref(false);

const isBlockPopup = ref(false);
const isSaveNotice = ref(false);
const isMenuImgPopup = ref(false);

const resvTab = ref('');

const appMenu = [
  { title: { icon: 'mdi-food', text: '점심 선택' }, action: nextLunch },
  { title: { icon: 'mdi-plus', text: '식당 등록' }, action: addRestraurant },
  { title: { icon: 'mdi-playlist-edit', text: '식당목록 관리' }, action: setRestraurantList },
  { title: { icon: 'mdi-logout', text: '로그아웃' }, action: logout }
];

const headerPrepayment = [
  { title: '날짜', key: 'date', width: 160 },
  { title: '금액', key: 'amount' },
  { title: '', key: 'delete', align: 'end', width: 8 }
];

const headers = computed(() => isMobile.value
  ? [
    { title: '식당', key: 'name', align: 'start' },
    { title: '예약메뉴', key: 'resvMenu', align: 'center' },
    { title: '전화', key: 'telNo', align: 'end', sortable: false }
  ]
  : [
    { title: '식당', key: 'name', align: 'start' },
    { title: '예약메뉴', key: 'resvMenu', align: 'center' },
    { title: '가격', key: 'cost', align: 'end' },
    { title: '선지불', key: 'prepay', align: 'end' },
    { title: '전화', key: 'telNo', align: 'end', sortable: false }
  ]
);

const listHeaders = [
  { title: '예약일', align: 'center', key: 'date', value: 'date' },
  { title: '메뉴', align: 'start', key: 'menu', value: 'menu' },
];

const restaurantKind = {
  '한식': 'mdi-bowl-mix',
  '중식': 'mdi-noodles',
  '패스트푸드': 'mdi-food-fork-drink',
  '분식': 'mdi-pot-steam',
  '일식': 'mdi-fish',
  '카페': 'mdi-coffee',
  '베이커리': 'mdi-baguette'
}

async function logout() {
  await signOut(auth);
  userStore.clearUser();

  const fullUrl = window.location.href;
  window.location.href = `https://immh78.github.io/tools/#/login?redirect=${encodeURIComponent(fullUrl)}`;
};

function nextLunch() {
  router.push("/");
}

function addRestraurant() {
  restaurantInfo.value = {};
  isRestaurantAdd.value = true;
  isRestaurantPopup.value = true;
}

function formatCurrency(amount) {
  return Number(amount).toLocaleString('ko-KR') + '원';
}


async function shareResv() {
  let prepayText = '';
  prepayPopupData.value.forEach(item => {
    const line = `${formatKoreanDate(item.date)} ${formatCurrency(item.amount).padStart(7)}`;
    prepayText += line + '\n';
  });

  // 합계 계산
  const total = prepayPopupData.value.reduce((sum, item) => sum + Number(item.amount), 0);
  prepayText += '──────────\n';
  prepayText += `합계     ${formatCurrency(total).padStart(7)}`;

  const content = `
━━━━━━━━━━
■ 메뉴 : ${resvPopupData.value.menu}
■ 가격 : ${formatCurrency(resvPopupData.value.cost)}
■ 예약일 : ${formatKoreanDate(resvPopupData.value.resvDate)}
━━━━━━━━━━

□ 선결제
${prepayText}`

  console.log("공유 내용", content);

  if (navigator.share) {
    await navigator.share({
      text: content
    });
  } else {
    alert('공유 API를 지원하지 않는 브라우저입니다.');
  }
}

async function selectRestaurant() {

  const dbRef = firebaseRef(database, "lunch-resv/restaurant");
  restaurant.value = [];
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        restaurantData.value = snapshot.val();
        Object.keys(restaurantData.value).forEach(r => {
          if (!blockRestaurant.value.includes(r)) {
            // 해당 ID의 모든 예약 가져오기
            const resvs = reservation.value.filter(resv => resv.restaurantId === r);

            // 정렬: 1순위 isReceipt === false 먼저, 2순위 최신 resvDate 내림차순
            const sorted = resvs.sort((a, b) => {
              if (a.isReceipt !== b.isReceipt) {
                return a.isReceipt ? 1 : -1; // false 먼저
              }
              return b.resvDate.localeCompare(a.resvDate); // 최신 날짜 우선
            });

            const selected = sorted[0]; // 최우선 예약 선택

            // 해당 식당의 선결제 내역 합계 계산
            const prepayments = prepayment.value[r] || [];
            const prepay = prepayments.reduce((sum, p) => sum + p.amount, 0);

            restaurant.value.push({
              ...restaurantData.value[r],
              id: r,
              ...(selected ? {
                resvMenu: selected.menu,
                resvDate: selected.resvDate,
                cost: selected.cost,
                isReceipt: selected.isReceipt,
                resvKey: selected.key
              } : {
                resvMenu: '',
                resvDate: '',
                cost: 0,
                isReceipt: true,
                resvKey: -1
              }),
              prepay
            });
          }
        });

        restaurant.value.sort((a, b) => {
          const aDate = a.resvDate;
          const bDate = b.resvDate;

          // a가 비어있고 b는 값이 있으면 b가 앞으로
          if (!aDate && bDate) return 1;
          if (aDate && !bDate) return -1;

          // 둘 다 비었으면 순서 유지
          if (!aDate && !bDate) return 0;

          // 둘 다 값이 있으면 내림차순 (역순)
          return bDate.localeCompare(aDate);
        });

        sumCost.value = restaurant.value.filter(item => item.isReceipt === false)
          .reduce((sum, item) => sum + (item.cost - item.prepay), 0);

      }
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
}

async function selectReservation() {
  const dbRef = firebaseRef(database, "lunch-resv/reservation/" + uid.value);
  reservation.value = [];

  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        Object.keys(data).forEach(key => {
          //console.log("key", key);
          reservation.value.push({ ...data[key], 'key': Number(key) });
        })


        //console.log(reservation.value)
      }
    })
    .catch(err => {
      //console.error("Error fetching data:", err);
    });
}

function formatKoreanDate(dateString) {

  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(5, 7), 10) - 1; // JS는 0부터 시작
  const day = parseInt(dateString.substring(8, 10), 10);

  const date = new Date(year, month, day);
  if (isNaN(date)) return '유효하지 않은 날짜';

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = dayNames[date.getDay()];

  return `${month + 1}.${day} (${weekday})`;
}

function getToday() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

function setRestraurantList() {
  isBlockPopup.value = true;
}

function getFormatedDate(raw) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function getNewKey(arr) {
  let key = 0;
  if (arr) {
    const keys = arr.map(item => item.key);
    // 0부터 순차적으로 증가하며 비어있는 값을 찾기
    while (keys.includes(key)) {
      key++;
    }
  } else {
    key = 0;
  }

  return key;
}

function onClickRestaurant(item) {

  resvPopupData.value = {
    "cost": item.cost,
    "isReceipt": item.isReceipt,
    "key": item.isReceipt ? -1 : item.resvKey,
    "menu": item.resvMenu,
    "restaurantId": item.id,
    "resvDate": item.isReceipt ? getNextFridayFormatted() : getFormatedDate(item.resvDate)
  }

  prepayPopupData.value = [];

  if (Array.isArray(prepayment.value[item.id])) {
    prepayment.value[item.id].forEach(r => {
      prepayPopupData.value.push({
        "amount": r.amount,
        "date": getFormatedDate(r.date)
      });
    })
  }

  prepayPopupData.value.sort((a, b) => {
    return b.date.localeCompare(a.date);
  });

  console.log("resvPopupData", resvPopupData.value);
  console.log("prepayPopupData", prepayPopupData.value);

  resvPopupRef.value.menuUrl = item.menuUrl;
  resvPopupRef.value.menuImgId = item.menuImgId;
  resvPopupRef.value.name = item.name;  

  console.log("resvPopupRef.value.menuImgId", resvPopupRef.value.menuImgId);
  console.log("preview.value", preview.value);

  isResvPopup.value = true;
}

function getNextFridayFormatted() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0(일) ~ 6(토)

  // 금요일까지 남은 일수 계산 (금요일: 5)
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;

  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);

  // "yyyy-MM-dd" 형식으로 반환
  const yyyy = nextFriday.getFullYear();
  const mm = String(nextFriday.getMonth() + 1).padStart(2, '0');
  const dd = String(nextFriday.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function menuList(id) {
  const uniqueMenus = [...new Set(
    reservation.value
      .filter(item => item.restaurantId === id) // GANG15 필터
      .map(item => item.menu)                         // 메뉴만 추출
  )];

  return uniqueMenus;
}

function onClickListMenu(item) {
  resvPopupData.value = item;
  resvPopupData.value.resvDate = getNextFridayFormatted();

  isListPopup.value = false;
  isResvPopup.value = true;
}

async function deleteResv(tab) {
  if (tab === 'menu') {
    try {
      const dbRef = firebaseRef(database, `lunch-resv/reservation/${uid.value}/${resvPopupData.value.key}`);
      await remove(dbRef); // 데이터를 저장
    } catch (err) {
      console.error("Error saving data:", err);
    }
    await selectReservation();
    await selectRestaurant();
    isResvPopup.value = false;

  } else {
    prepayPopupData.value = [];
  }
}



async function saveResv(tab, recp) {
  //console.log("menu", resv.value);
  if (tab === 'menu') {
    if (resvPopupData.value.menu !== '') {

      const key = resvPopupData.value.key === -1 ? getNewKey(reservation.value) : resvPopupData.value.key;

      const data = {
        [key]: {
          "cost": Number(resvPopupData.value.cost),
          "isReceipt": recp,
          "menu": resvPopupData.value.menu,
          "restaurantId": resvPopupData.value.restaurantId,
          "resvDate": resvPopupData.value.resvDate.replace(/-/g, '')
        }
      }

      try {
        const dbRef = firebaseRef(database, "lunch-resv/reservation/" + uid.value);
        await update(dbRef, data); // 데이터를 저장
      } catch (err) {
        console.error("Error saving data:", err);
      }

      if (recp) {
        try {
          const dbRefDel = firebaseRef(database, `lunch-resv/prepayment/${uid.value}/${resvPopupData.value.restaurantId}`);
          await remove(dbRefDel); // key 업데이트
        } catch (err) {
          console.error("Error delete :", err);
        }
      }

      await selectReservation();
      await selectPrepayment();

      isResvPopup.value = false;
    } else {
      return;
    }
  } else {
    const data = prepayPopupData.value.map(item => ({
      amount: Number(item.amount),
      date: item.date.replace(/-/g, '')
    }));

    try {
      const dbRef = firebaseRef(database, `lunch-resv/prepayment/${uid.value}/${resvPopupData.value.restaurantId}`);
      await set(dbRef, data); // 데이터를 저장
    } catch (err) {
      console.error("Error saving data:", err);
    }

    await selectPrepayment();
  }

  await selectRestaurant();
  isSaveNotice.value = true; // 저장 완료 알림 표시  

}


async function saveRestaurant() {
  const data = {
    "name": restaurantInfo.value.name,
    "telNo": restaurantInfo.value.telNo,
    "menuUrl": restaurantInfo.value.menuUrl,
    "kind": restaurantInfo.value.kind,
    "menuImgId": restaurantInfo.value.menuImgId,
  }

  try {
    const dbRef = firebaseRef(database, "lunch-resv/restaurant/" + restaurantInfo.value.id);
    await update(dbRef, data); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }

  selectRestaurant();
  isRestaurantPopup.value = false;
}

async function selectData() {
  isLoading.value = true;          // <-- 로딩 시작
  try {
    await selectReservation();
    await selectPrepayment();
    await selectRestaurant();
  } finally {
    isLoading.value = false;       // <-- 로딩 종료
  }
}

async function selectPrepayment() {
  prepayment.value = [];

  const dbRef = firebaseRef(database, "lunch-resv/prepayment/" + uid.value);
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        prepayment.value = snapshot.val();
      }
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
}


async function selectBlockRestaurant() {
  blockRestaurant.value = [];

  const dbRef = firebaseRef(database, "lunch-resv/blockRestaurant/resv/" + uid.value);
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        blockRestaurant.value = snapshot.val();
      }
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
}

function addBlockRestaurant() {
  if (!blockRestaurant.value.includes(resvPopupData.value.restaurantId)) {
    blockRestaurant.value.push(resvPopupData.value.restaurantId);
  }

  saveBlockRestaurant()
}

async function removeBlockRestaurant(resvId) {
  const index = blockRestaurant.value.indexOf(resvId);
  if (index > -1) {
    blockRestaurant.value.splice(index, 1);  // 배열에서 제거
  }
  await saveBlockRestaurant();
}

async function recoverBlockRestaurant(resvId) {
  await removeBlockRestaurant(resvId);
  isBlockPopup.value = false;
  selectRestaurant();
}

async function saveBlockRestaurant() {
  try {
    const dbRef = firebaseRef(database, "lunch-resv/blockRestaurant/resv/" + uid.value);
    await set(dbRef, blockRestaurant.value); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }

  await selectRestaurant();
}

function openListPopup(item) {
  listPopupTitle.value = item.name;
  listPopupSelectable.value = item.isReceipt;

  listPopupData.value = reservation.value.filter(log => log.restaurantId === item.id)
    .sort((a, b) => b.resvDate.localeCompare(a.resvDate)); // 최신 순 정렬

  //console.log("listPopupData", listPopupData.value);

  isListPopup.value = true;
}

function onClickAddPrepay() {
  prepayPopupData.value.unshift({ "amount": null, "date": getFormatedDate(getToday()) });
}


function onClickEditRestaurant() {
  restaurantInfo.value = restaurantData.value[resvPopupData.value.restaurantId];
  restaurantInfo.value.id = resvPopupData.value.restaurantId;

  isRestaurantAdd.value = false;
  isResvPopup.value = false;
  isRestaurantPopup.value = true;

}

function onClickDelPrepay(index) {
  prepayPopupData.value.splice(index, 1);
}

const rules = {
  required: v => !!v || '필수 입력 값입니다.',
  uppercase: v => /^[A-Z0-9]+$/.test(v) || '대문자와 숫자만 입력하세요.'
}

function toUpper(val) {
  restaurantInfo.value.id = val.toUpperCase()
}

function onClickMenuImgPopup() {
  preview.value = cld.image(resvPopupRef.value.menuImgId).format('auto').quality('auto')
  isMenuImgPopup.value = true;
}

function openWidget() {
  widget && widget.open();
}

onMounted(async () => {
  uid.value = userStore.user.uid;

  await selectBlockRestaurant()
  await selectData();

  // 글로벌 위젯 객체
  widget = window.cloudinary?.createUploadWidget(
    {
      cloudName: cloudName,
      uploadPreset: uploadPreset,
      sources: ['local', 'url', 'camera'],
      multiple: false,
      folder: 'images',
      maxFileSize: 5_000_000,
      cropping: false,
      clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      showAdvancedOptions: false,
      showPoweredBy: false,
      styles: { palette: { windowBorder: '#ddd' } }
    },
    (error, result) => {
      if (!error && result && result.event === 'success') {
        const info = result.info;
        lastPublicId.value = info.public_id;
        restaurantInfo.value.menuImgId = lastPublicId.value;        
      } else if (result && result.event === 'close') {
        lastPublicId.value = ''; // 업로드 취소 시 초기화
      } else if (error) {
        lastPublicId.value = ''; // 오류 시 초기화
      }
    }
  );

  console.log("blockRestaurant", blockRestaurant.value);
  console.log("restaurant", restaurant.value);
  console.log("restaurantData", restaurantData.value);
  console.log("reservation", reservation.value);
  console.log("prepayment", prepayment.value);
});



//console.log('user', user);
</script>

<template>
  <v-app>
    <v-app-bar color="teal-darken-4">
      <template v-slot:image>
        <v-img gradient="to top right, rgba(19,84,122,.8), rgba(128,208,199,.8)"></v-img>
      </template>
      <template v-slot:append>
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-btn icon="mdi-dots-vertical" variant="text" v-bind="props"></v-btn>
          </template>
          <v-list>
            <v-list-item v-for="(menu, i) in appMenu" :key="i" :value="i" @click="menu.action"
              :prepend-icon="menu.title.icon">
              <v-list-item-title>{{ menu.title.text }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
      <v-app-bar-title class="d-flex align-center">
        <span class="d-inline-flex justify-center align-center mr-2" style="width:28px">
          <v-progress-circular v-if="isLoading" indeterminate size="21" width="2" color="white" />
          <v-icon v-else size="24" @click="selectData()">mdi-package-variant
          </v-icon>
        </span>
        포장 예약
        <span class="semi-transparent-text"> {{ sumCost.toLocaleString('ko-KR') }}원</span>
      </v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-data-table :headers="headers" :items="restaurant" no-data-text="조회중입니다." loading-text="조회중입니다."
        hide-default-footer items-per-page="-1" :show-items-per-page="false">
        <template v-slot:item.name="{ item }">
          <v-btn :variant="item.isReceipt ? 'tonal' : 'flat'" color="primary" class="px-1"
            @click="onClickRestaurant(item)"><v-icon>{{ restaurantKind[item.kind] }}</v-icon> {{ item.name }}</v-btn>
        </template>
        <template v-slot:item.resvMenu="{ item }">
          <div :style="{ textAlign: 'center', cursor: item.resvMenu ? 'pointer' : '' }"
            @click="item.resvMenu ? openListPopup(item) : null">
            <span :class="item.isReceipt ? 'text-grey' : item.prepay >= item.cost ? 'text-primary' : 'text-error'">
              {{ item.resvMenu }}</span><br />
            <small v-if="!item.isReceipt && item.cost > 0" style="color: grey;">({{ (item.cost -
              item.prepay).toLocaleString('ko-KR')
            }})</small>
          </div>
        </template>
        <template v-slot:item.telNo="{ item }">
          <v-btn v-if="isMobile" class="pa-0" icon="mdi-phone" size="small" :href="'tel:' + item.telNo" />
          <div v-else>
            <v-icon size="18">mdi-phone</v-icon>
            <span class="ml-1">{{ item.telNo }}</span>
          </div>
        </template>
        <template #item.cost="{ item }">
          <span v-if="item.cost > 0" :style="{ color: item.isReceipt ? 'silver' : 'black' }">{{
            item.cost.toLocaleString('ko-KR') }}</span>
        </template>
        <template #item.prepay="{ item }">
          <span v-if="item.cost > 0" :style="{ color: item.isReceipt ? 'silver' : 'black' }">{{
            item.prepay.toLocaleString('ko-KR') }}</span>
        </template>
      </v-data-table>
    </v-main>

    <!-- 예약 팝업 -->
    <v-dialog v-model="isResvPopup" max-width="600px" persistent>
      <v-card style="height: 600px; display: flex; flex-direction: column;">
        <v-card-title class="d-flex align-center">{{ resvPopupRef.name }}
          <v-icon class="ml-1" size="18px" @click="onClickEditRestaurant()">mdi-pencil</v-icon>
          <v-spacer></v-spacer>
          <v-btn v-if="resvPopupRef.menuImgId" variant="text" @click="onClickMenuImgPopup()"
            icon="mdi-feature-search-outline" />
          <v-btn v-else variant="text" :href="resvPopupRef.menuUrl" target="_blank" rel="noopener"
            icon="mdi-feature-search-outline" />

        </v-card-title>
        <v-tabs v-model="resvTab" align-tabs="center" color="deep-purple-accent-4">
          <v-tab value="menu">메뉴</v-tab>
          <v-tab value="prepayment">선지불</v-tab>
        </v-tabs>
        <v-tabs-window v-model="resvTab">
          <v-tabs-window-item value="menu">
            <v-card-text style="height: 320px; overflow-y: auto;">
              <v-text-field v-model="resvPopupData.menu" label="메뉴" variant="outlined"
                :rules="[v => !!v || '메뉴는 필수입니다']" />
              <v-row>
                <v-col col="6"><v-text-field v-model="resvPopupData.cost" label="가격" type="number"
                    variant="outlined" /></v-col>
                <v-col col="6">
                  <v-text-field readonly label="선지불" variant="outlined"
                    :model-value="prepayPopupData.reduce((sum, item) => sum + Number(item.amount), 0)" />
                </v-col>
              </v-row>
              <v-text-field v-model="resvPopupData.resvDate" label="예약일" type="date" variant="outlined" />
            </v-card-text>
          </v-tabs-window-item>
          <v-tabs-window-item value="prepayment">
            <v-card-text class='mx-1 px-0' style="height: 320px; overflow-y: auto;">
              <v-data-table :headers="headerPrepayment" :items="prepayPopupData" hide-default-footer items-per-page="-1"
                :show-items-per-page="false">
                <template #header.delete>
                  <v-btn icon="mdi-plus" variant="text" @click="onClickAddPrepay()" />
                </template>
                <template #item.date="{ item }">
                  <v-text-field v-model="item.date" variant="plain" type="date" />
                </template>
                <template #item.amount="{ item }">
                  <v-text-field v-model="item.amount" variant="plain" type="number" />
                </template>
                <template #item.delete="{ item, index }">
                  <v-btn icon="mdi-delete" variant="text" @click="onClickDelPrepay(index)" />
                </template>
              </v-data-table>
            </v-card-text>
          </v-tabs-window-item>
        </v-tabs-window>
        <v-card-actions>
          <v-btn @click="shareResv()" icon="mdi-share-variant" variant="text"></v-btn>
          <v-spacer></v-spacer>
          <v-btn @click="saveResv(resvTab, true)" :disabled="resvTab !== 'menu' || resvPopupData.isReceipt"
            icon="mdi-package-variant-closed-check" variant="text"></v-btn>
          <v-btn @click="saveResv(resvTab, false)" :disabled="resvPopupData.menu === ''" icon="mdi-content-save"
            variant="text"></v-btn>
          <v-btn @click="deleteResv(resvTab)" :disabled="resvPopupData.key === -1 && resvTab === 'menu'"
            icon="mdi-delete" variant="text"></v-btn>
          <v-btn @click="isResvPopup = false" icon="mdi-close-thick"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isListPopup" max-width="600px">
      <v-card :title="listPopupTitle">
        <v-data-table :headers="listHeaders" :items="listPopupData" no-data-text="조회중입니다." loading-text="조회중입니다."
          hide-default-footer items-per-page="-1" :show-items-per-page="false">
          <template v-slot:item.date="{ item }">
            <span>{{ formatKoreanDate(getFormatedDate(item.resvDate)) }}</span>
          </template>

          <template v-slot:item.menu="{ item }">
            <span :style="{ cursor: listPopupSelectable ? 'pointer' : '' }"
              @click="listPopupSelectable ? onClickListMenu(item) : null">{{ item.menu }}</span>
          </template>
        </v-data-table>
        <v-card-actions>
          <v-btn @click="isListPopup = false" icon="mdi-close-thick"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isBlockPopup" max-width="600px">
      <v-card>
        <v-card-title>숨김 식당목록 관리</v-card-title>
        <v-card-text>
          <v-table>
            <thead>
              <tr>
                <th class="text-left">
                  식당
                </th>
                <th class="text-right">
                  숨김취소
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in blockRestaurant" :key="item">
                <td>{{ restaurantData[item].name }}</td>
                <td align="center"><v-icon @click="recoverBlockRestaurant(item)">mdi-reply</v-icon></td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-fab icon="mdi-close-thick" @click="isBlockPopup = false" class="fixed-fab" color="blue"></v-fab>
      </v-card>

    </v-dialog>

    <v-dialog v-model="isRestaurantPopup" max-width="600px">
      <v-card>
        <v-card-title>{{ isRestaurantAdd ? "식당 등록" : restaurantInfo.id }}</v-card-title>
        <v-card-text>
          <v-text-field v-if="isRestaurantAdd" v-model="restaurantInfo.id" label="식당 ID" variant="outlined"
            :rules="[rules.required, rules.uppercase]" @update:model-value="toUpper" />
          <v-text-field v-model="restaurantInfo.name" label="식당명" variant="outlined" :rules="[rules.required]" />
          <v-combobox v-model="restaurantInfo.kind" label="종류" :items="Object.keys(restaurantKind)"
            variant="outlined"></v-combobox>
          <v-text-field v-model="restaurantInfo.telNo" label="전화번호" variant="outlined"></v-text-field>
          <v-row>
            <v-col cols="10">
              <v-text-field v-if="restaurantInfo.menuImgId" v-model="restaurantInfo.menuImgId" label="메뉴 이미지 ID" variant="outlined" class="menu-url-field" />
              <v-text-field v-else v-model="restaurantInfo.menuUrl" label="메뉴 URL" variant="outlined" class="menu-url-field" />
            </v-col>
            <v-col cols="2" class="d-flex justify-center align-center">
              <v-btn @click="openWidget" icon="mdi-camera" variant="text"></v-btn>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-btn icon="mdi-cancel" :color="blockRestaurant.includes(restaurantInfo.id) ? 'red' : 'black'"
            @click="blockRestaurant.includes(restaurantInfo.id) ? removeBlockRestaurant(restaurantInfo.id) : addBlockRestaurant()"></v-btn>
          <v-spacer></v-spacer>

          <v-btn @click="saveRestaurant()" icon="mdi-check-bold"></v-btn>
          <v-btn @click="isRestaurantPopup = false" icon="mdi-close-thick"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="isMenuImgPopup" max-width="600px">
      <v-card>
        <AdvancedImage :cldImg="preview" :plugins="[responsive(), placeholder({ mode: 'blur' })]"
        class="max-w-full rounded-lg shadow" />
      </v-card>
    </v-dialog>

    <v-snackbar v-model="isSaveNotice">저장 완료!</v-snackbar>
  </v-app>
</template>

<style scoped>
.menu-url-field input {
  white-space: nowrap;
  overflow-x: auto;
}

.fixed-fab {
  position: fixed;
  bottom: 16px;
  /* 화면 하단에서 16px 위 */
  right: 16px;
  /* 화면 우측에서 16px 왼쪽 */
  z-index: 1050;
  /* 다른 요소 위에 표시되도록 설정 */
}

.semi-transparent-text {
  opacity: 0.5;
  /* 50% 투명도 */
}
</style>