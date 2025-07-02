<script setup>
import { ref, onMounted, computed } from 'vue';
import { useDisplay } from 'vuetify';
import { useUserStore } from '../store/user';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { database, ref as firebaseRef, get, set, update, remove } from "../config/firebase";
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

const { mdAndDown } = useDisplay();  // md 이하 (xs, sm, md) → 모바일
const isMobile = mdAndDown;         // 그대로 사용하면 됨

const restaurant = ref([]);
const restaurantData = ref({});
const restaurantInfo = ref({});
const reservation = ref([]);
const isResvPopup = ref(false);
const resv = ref({});
const blockRestaurant = ref([]);
const resvPopupRef = ref({});
const prepayment = ref({});

const isListPopup = ref(false);
const listPopupTitle = ref('');
const listTable = ref([]);
const uid = ref("");

const isLoading = ref(false);
const isRestaurantPopup = ref(false);
const isRestaurantAdd = ref(false);

const resvTab = ref('');

const appMenu = [
  { title: '식당 등록', action: addRestraurant },
  { title: '점심 선택', action: nextLunch },
  { title: '로그아웃', action: logout }
];


const headerPrepayment = [
  { title: '날짜', key: 'date' },
  { title: '금액', key: 'amount' },
  { title: '', key: 'delete' }
];

const headers = [
  { title: '식당', key: 'name', align: 'start' },
  { title: '예약메뉴', key: 'resvMenu', align: 'start' },
  { title: '전화', key: 'telNo', align: 'end', sortable: false }
];

const listHeaders = [
  { title: '방문일', align: 'center', key: 'date', value: 'date' },
  { title: '메뉴', align: 'start', key: 'menu', value: 'menu' },
];

const restaurantKind = ['한식', '중식', '패스트푸드', '일식', '카페', '베이커리'];

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
                isReceipt: selected.isReceipt
              } : {
                resvMenu: '',
                resvDate: '',
                cost: 0,
                isReceipt: true
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

      }
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
}

async function selectReservation() {
  const dbRef = firebaseRef(database, "lunch-resv/reservation/" + uid.value);
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        reservation.value = snapshot.val();
        //console.log(reservation.value)
      }
    })
    .catch(err => {
      //console.error("Error fetching data:", err);
    });
}

function formatKoreanDate(dateString) {
  if (!/^\d{8}$/.test(dateString)) return '잘못된 형식';

  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1; // JS는 0부터 시작
  const day = parseInt(dateString.substring(6, 8), 10);

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


function foodImage(s) {
  let icon;
  switch (s) {
    case '한식':
      icon = 'mdi-bowl-mix';
      break;
    case '중식':
      icon = 'mdi-noodles';
      break;
    case '패스트푸드':
      icon = 'mdi-food-fork-drink';
      break;
    case '일식':
      icon = 'mdi-fish';
    case '카페':
      icon = 'mdi-coffee';
    case '베이커리':
      icon = 'mdi-baguette';
      break;
  }

  return icon;
}

function getFormatedDate(raw) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function onClickRestaurant(item) {
  resv.value = {
    "cost": item.cost,
    "isReceipt": item.isReceipt,
    "menu": item.resvMenu,
    "restaurantId": item.id,
    "resvDate": getFormatedDate(item.resvDate)
  }

  console.log("resv.value", resv.value);

  resvPopupRef.value.menuUrl = item.menuUrl;
  resvPopupRef.value.name = item.name;

  isResvPopup.value = true;
}


function menuList(id) {
  const uniqueMenus = [...new Set(
    reservation.value
      .filter(item => item.restaurantId === id) // GANG15 필터
      .map(item => item.menu)                         // 메뉴만 추출
  )];

  return uniqueMenus;
}

function saveListMenu(item) {
  resv.value = item;
  resv.value.date = getToday();

  saveResv();
  isListPopup.value = false;
}
async function saveResv() {
  //console.log("menu", resv.value);

  if (!reservation.value[reservation.value.length - 1].isReceipt) {
    reservation.value.pop();
  }

  const data = {
    [reservation.value.length]: {
      "cost": resv.value.cost,
      "isReceipt": false,
      "menu": resv.value.menu,
      "restaurantId": resv.value.restaurantId,
      "resvDate": resv.value.resvDate.replace(/-/g, '')
    }
  }

  try {
    const dbRef = firebaseRef(database, "lunch-resv/reservation/" + uid.value);
    await update(dbRef, data); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }

  await selectReservation();
  await selectRestaurant();
  isResvPopup.value = false;
}

async function deleteMenu() {

  try {
    const dbRef = firebaseRef(database, "lunch-resv/reservation/" + uid.value + "/" + (reservation.value.length - 1));
    await remove(dbRef); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }

  await selectReservation();
  await selectRestaurant();
  isResvPopup.value = false;
}

async function saveRestaurant() {
  const data = {
    "name": restaurantInfo.value.name,
    "telNo": restaurantInfo.value.telNo,
    "menuUrl": restaurantInfo.value.menuUrl,
    "kind": restaurantInfo.value.kind
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
  const dbRef = firebaseRef(database, "lunch-resv/blockRestaurant/resv/" + uid.value);
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        blockRestaurant.value = snapshot.val();
      } else {
        blockRestaurant.value = [];
      }
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
}

function addBlockRestaurant() {
  if (!blockRestaurant.value.includes(resv.value.restaurantId)) {
    blockRestaurant.value.push(resv.value.restaurantId);
  }

  saveBlockRestaurant()
}

function removeBlockRestaurant() {
  const index = blockRestaurant.value.indexOf(resv.value.restaurantId);
  if (index > -1) {
    blockRestaurant.value.splice(index, 1);  // 배열에서 제거
  }
  saveBlockRestaurant()
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

  listTable.value = reservation.value.filter(log => log.restaurantId === item.id)
    .sort((a, b) => b.date.localeCompare(a.date)); // 최신 순 정렬

  console.log(listTable.value);

  isListPopup.value = true;
}

function onClickAddPrepay() {
  console.log(resv.value.restaurantId)
  prepayment.value[resv.value.restaurantId].push({ "amount": 0, "date": "20250703" });
  console.log(prepayment.value[resv.value.restaurantId])
}


function onClickEditRestaurant() {
  restaurantInfo.value = restaurantData.value[resv.value.restaurantId];
  restaurantInfo.value.id = resv.value.restaurantId;

  isRestaurantAdd.value = false;
  isResvPopup.value = false;
  isRestaurantPopup.value = true;

}

const rules = {
  required: v => !!v || '필수 입력 값입니다.',
  uppercase: v => /^[A-Z0-9]+$/.test(v) || '대문자와 숫자만 입력하세요.'
}

function toUpper(val) {
  restaurantInfo.value.id = val.toUpperCase()
}

onMounted(async () => {
  uid.value = userStore.user.uid;

  await selectBlockRestaurant()
  await selectData();

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
            <v-list-item v-for="(menu, i) in appMenu" :key="i" :value="i" @click="menu.action">
              <v-list-item-title>{{ menu.title }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
      <v-app-bar-title class="d-flex align-center">
        <span class="d-inline-flex justify-center align-center mr-2" style="width:28px">
          <v-progress-circular v-if="isLoading" indeterminate size="21" width="2" color="white" />
          <v-icon v-else size="24" @click="selectData()">mdi-food
          </v-icon>
        </span>
        포장 예약
      </v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-data-table :headers="headers" :items="restaurant" no-data-text="조회중입니다." loading-text="조회중입니다."
        hide-default-footer items-per-page="-1" :show-items-per-page="false">
        <template v-slot:item.name="{ item }">
          <v-btn :variant="item.lastDate === getToday() ? 'flat' : 'tonal'"
            :color="blockRestaurant.includes(item.id) ? 'grey-darken-3' : 'primary'" class="px-1"
            @click="onClickRestaurant(item)"><v-icon>{{ foodImage(item.kind) }}</v-icon> {{ item.name }}</v-btn>
        </template>
        <template v-slot:item.lastDate="{ item }">
          <div :style="{ cursor: item.lastDate ? 'pointer' : '' }" @click="item.lastDate ? openListPopup(item) : null">
            <span>{{ item.lastDate ? formatKoreanDate(item.lastDate) : '' }}</span><br />
            <small v-if="isMobile" style="color:grey">{{ item.lastMenu }}</small>
          </div>
        </template>
        <template v-slot:item.lastMenu="{ item }">
          <span style="cursor: pointer;" @click="item.lastDate ? openListPopup(item) : null">{{ item.lastMenu }}</span>
        </template>
        <template v-slot:item.telNo="{ item }">
          <v-btn v-if="isMobile" class="pa-0" icon="mdi-phone" size="small" :href="'tel:' + item.telNo" />
          <div v-else>
            <v-icon size="18">mdi-phone</v-icon>
            <span class="ml-1">{{ item.telNo }}</span>
          </div>
        </template>


      </v-data-table>
    </v-main>

    <!-- 예약 팝업 -->
    <v-dialog v-model="isResvPopup" max-width="600px" persistent>
      <v-card style="height: 600px; display: flex; flex-direction: column;">
        <v-card-title class="d-flex align-center">{{ resvPopupRef.name }}
          <v-icon class="ml-1" size="18px" @click="onClickEditRestaurant()">mdi-pencil</v-icon>
          <v-spacer></v-spacer>
          <v-btn variant="text" :href="resvPopupRef.menuUrl" target="_blank" rel="noopener">
            <v-icon>mdi-feature-search-outline</v-icon>
          </v-btn>
        </v-card-title>
        <v-tabs v-model="resvTab" align-tabs="center" color="deep-purple-accent-4">
          <v-tab value="menu">메뉴</v-tab>
          <v-tab value="prepayment">선지불</v-tab>
        </v-tabs>
        <v-tabs-window v-model="resvTab">
          <v-tabs-window-item value="menu">
            <v-card-text style="height: 320px; overflow-y: auto;">
              <v-text-field v-model="resv.menu" label="메뉴" variant="outlined" />
              <v-text-field v-model="resv.cost" label="가격" type="number" variant="outlined" />
              <v-text-field v-model="resv.resvDate" label="예약일" type="date" variant="outlined" />
            </v-card-text>
          </v-tabs-window-item>
          <v-tabs-window-item value="prepayment">
            <v-card-text style="height: 320px; overflow-y: auto;">
              <v-data-table :headers="headerPrepayment" :items="prepayment[resv.restaurantId]" hide-default-footer
                items-per-page="-1" :show-items-per-page="false">
                <template #header.delete>
                  <v-btn size="small" @click="onClickAddPrepay()">추가</v-btn>
                </template>
                <template #item.delete="{ item }">
                  <v-btn size="small">del</v-btn>
                </template>
              </v-data-table>
            </v-card-text>
          </v-tabs-window-item>
        </v-tabs-window>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="saveResv()" :disabled="resvTab !== 'menu'" icon="mdi-package-variant-closed-check"
            variant="text"></v-btn>
          <v-btn @click="saveResv()" :disabled="resvTab !== 'menu'" icon="mdi-content-save" variant="text"></v-btn>
          <v-btn @click="deleteMenu()" :disabled="!resvPopupRef.isChoice" icon="mdi-delete" variant="text"></v-btn>
          <v-btn @click="isResvPopup = false" icon="mdi-close-thick"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isListPopup" max-width="600px">
      <v-card :title="listPopupTitle">
        <v-data-table :headers="listHeaders" :items="listTable" no-data-text="조회중입니다." loading-text="조회중입니다."
          hide-default-footer items-per-page="-1" :show-items-per-page="false">
          <template v-slot:item.date="{ item }">
            <span>{{ formatKoreanDate(item.date) }}</span>
          </template>

          <template v-slot:item.menu="{ item }">
            <span style="cursor: pointer;" @click="saveListMenu(item)">{{ item.menu }}</span>
          </template>
        </v-data-table>

        <v-card-actions>
          <v-btn @click="isListPopup = false" icon="mdi-close-thick"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="isRestaurantPopup" max-width="600px">
      <v-card>
        <v-card-title>{{ isRestaurantAdd ? "식당 등록" : restaurantInfo.id }}</v-card-title>
        <v-card-text>
          <v-text-field v-if="isRestaurantAdd" v-model="restaurantInfo.id" label="식당 ID" variant="outlined"
            :rules="[rules.required, rules.uppercase]" @update:model-value="toUpper" />
          <v-text-field v-model="restaurantInfo.name" label="식당명" variant="outlined" :rules="[rules.required]" />
          <v-combobox v-model="restaurantInfo.kind" label="종류" :items="restaurantKind" variant="outlined"></v-combobox>
          <v-text-field v-model="restaurantInfo.telNo" label="전화번호" variant="outlined"></v-text-field>
          <v-text-field v-model="restaurantInfo.menuUrl" label="메뉴 URL" variant="outlined" class="menu-url-field" />
        </v-card-text>
        <v-card-actions>
          <v-btn @click="saveRestaurant()" icon="mdi-check-bold"></v-btn>
          <v-btn @click="isRestaurantPopup = false" icon="mdi-close-thick"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style scoped>
.menu-url-field input {
  white-space: nowrap;
  overflow-x: auto;
}
</style>