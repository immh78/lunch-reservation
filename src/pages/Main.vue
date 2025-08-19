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
import RestaurantPopup from '../components/RestaurantPopup.vue'

/* Cloudinary 설정 */
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const lastPublicId = ref('');
const cld = new Cloudinary({ cloud: { cloudName } });
const preview = ref(null);

let widget;
//------------------------------------------------

const userStore = useUserStore();
const router = useRouter();

const { mdAndDown } = useDisplay();  // md 이하 (xs, sm, md) → 모바일
const isMobile = mdAndDown;         // 그대로 사용하면 됨

const userInfo = ref({});
const restaurant = ref([]);
const restaurantDB = ref({});
const restaurantInfo = ref({});
const visitLog = ref([]);
const isMenuPopup = ref(false);
const visit = ref({});
const blockRestaurant = ref([]);
const menuPopupRef = ref({});

const isListPopup = ref(false);
const listPopupTitle = ref('');
const listTable = ref([]);
const uid = ref("");

const isLoading = ref(false);
const isRestaurantPopup = ref(false);
const isRestaurantAdd = ref(false);
const isMenuImgPopup = ref(false);

const appMenu = [
  { title: {icon: 'mdi-package-variant', text :'포장 예약'}, action: nextReservation },
  { title: {icon: 'mdi-plus', text: '식당 등록'}, action: addRestraurant },
  { title: {icon: 'mdi-logout', text: '로그아웃' }, action: logout }
];


const headers = computed(() => isMobile.value
  ? [
    { title: '식당', key: 'name', align: 'start' },
    { title: '방문일', key: 'lastDate', align: 'center' },
    { title: '전화', key: 'telNo', align: 'end', sortable: false }
  ]
  : [
    { title: '식당', key: 'name', align: 'start' },
    { title: '방문일', key: 'lastDate', align: 'center' },
    { title: '메뉴', key: 'lastMenu', align: 'start' },
    { title: '전화번호', key: 'telNo', align: 'start', sortable: false }
  ]
);

const listHeaders = [
  { title: '방문일', align: 'center', key: 'date', value: 'date' },
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

async function selectUser() {
  const dbRef = firebaseRef(database, "user/" + uid.value);
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        userInfo.value = snapshot.val();
      }
    })
    .catch(err => {
      //console.error("Error fetching data:", err);
    });
}

function nextReservation() {
  router.push("/reservation");
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
        restaurantDB.value = snapshot.val();
        Object.keys(restaurantDB.value).forEach(r => {
          restaurant.value.push({ ...restaurantDB.value[r], "id": r });
        })
      }
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });

  restaurant.value.forEach(r => {
    const logs = visitLog.value
      .filter(log => log.restaurantId === r.id)
      .sort((a, b) => b.date.localeCompare(a.date)); // 최신 순 정렬

    //console.log('logs', r.id, logs);

    const latest = logs[0];
    if (latest) {
      r.lastDate = latest.date;
      r.lastMenu = latest.menu;
    } else {
      r.lastDate = null;
      r.lastMenu = null;
    }
  });


  // restaurant.value = restaurant.value.sort((a, b) => {
  //   if (!a.lastDate && !b.lastDate) return 0;           // 둘 다 null
  //   if (!a.lastDate) return 1;                          // a가 null이면 뒤로
  //   if (!b.lastDate) return -1;                         // b가 null이면 앞으로
  //   return a.lastDate.localeCompare(b.lastDate);        // 문자열 날짜 내림차순
  // });

  restaurant.value = restaurant.value.sort((a, b) => {
    const isBlockedA = blockRestaurant.value.includes(a.id);
    const isBlockedB = blockRestaurant.value.includes(b.id);

    // 1. 둘 중 하나라도 block이면 맨 뒤로
    if (isBlockedA && !isBlockedB) return 1;
    if (!isBlockedA && isBlockedB) return -1;
    if (isBlockedA && isBlockedB) return 0;

    // 2. 날짜가 null인 경우 뒤로
    if (!a.lastDate && !b.lastDate) return 0;
    if (!a.lastDate) return 1;
    if (!b.lastDate) return -1;

    // 3. 날짜가 있는 경우 최신순 정렬
    return a.lastDate.localeCompare(b.lastDate);
  });

  //console.log('restaurant #3', restaurant.value);
  //console.log('blockRestaurant', blockRestaurant.value);
}

async function selectVisitLog() {
  const dbRef = firebaseRef(database, "lunch-resv/visitLog/" + uid.value);
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        visitLog.value = snapshot.val();
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

function choiceMenu(item) {
  visit.value.date = getToday();
  visit.value.restaurantId = item.id;
  visit.value.menu = item.lastMenu;

  menuPopupRef.value.isChoice = item.lastDate === getToday();
  menuPopupRef.value.menuUrl = item.menuUrl;
  menuPopupRef.value.menuImgId = item.menuImgId;
  menuPopupRef.value.name = item.name;

  isMenuPopup.value = true;

  //console.log(visit.value);
}


function menuList(id) {
  const uniqueMenus = [...new Set(
    visitLog.value
      .filter(item => item.restaurantId === id) // GANG15 필터
      .map(item => item.menu)                         // 메뉴만 추출
  )];

  return uniqueMenus;
}

function saveListMenu(item) {
  visit.value = {...item};
  visit.value.date = getToday();

  saveMenu();
  isListPopup.value = false;
}
async function saveMenu() {
  //console.log("menu", visitLog.value[visitLog.value.length - 1], getToday());

  if (visitLog.value[visitLog.value.length - 1].date === getToday()) {
    visitLog.value.pop();
  }

  const data = {
    [visitLog.value.length]: visit.value
  }

  //console.log("data", data);

  try {
    const dbRef = firebaseRef(database, "lunch-resv/visitLog/" + uid.value);
    await update(dbRef, data); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }

  await selectVisitLog();
  await selectRestaurant();
  isMenuPopup.value = false;
}

async function deleteMenu() {

  try {
    const dbRef = firebaseRef(database, "lunch-resv/visitLog/" + uid.value + "/" + (visitLog.value.length - 1));
    await remove(dbRef); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }

  await selectVisitLog();
  await selectRestaurant();
  isMenuPopup.value = false;
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
    await selectUser();
    await selectVisitLog();
    await selectRestaurant();
  } finally {
    isLoading.value = false;       // <-- 로딩 종료
  }
}

async function selectBlockRestaurant() {
  const dbRef = firebaseRef(database, "lunch-resv/blockRestaurant/lunch/" + uid.value);
  get(dbRef)
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
  if (!blockRestaurant.value.includes(visit.value.restaurantId)) {
    blockRestaurant.value.push(visit.value.restaurantId);
  }

  saveBlockRestaurant()
}

function removeBlockRestaurant() {
  const index = blockRestaurant.value.indexOf(visit.value.restaurantId);
  if (index > -1) {
    blockRestaurant.value.splice(index, 1);  // 배열에서 제거
  }
  saveBlockRestaurant()
}


async function saveBlockRestaurant() {
  try {
    const dbRef = firebaseRef(database, "lunch-resv/blockRestaurant/lunch/" + uid.value);
    await set(dbRef, blockRestaurant.value); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }

  await selectRestaurant();
}

function openListPopup(item) {
  listPopupTitle.value = item.name;

  listTable.value = visitLog.value.filter(log => log.restaurantId === item.id)
    .sort((a, b) => b.date.localeCompare(a.date)); // 최신 순 정렬

  console.log(listTable.value);

  isListPopup.value = true;
}

function onClickEditRestaurant() {
  restaurantInfo.value = restaurantDB.value[visit.value.restaurantId];
  restaurantInfo.value.id = visit.value.restaurantId;

  isRestaurantAdd.value = false;
  isMenuPopup.value = false;
  isRestaurantPopup.value = true;

}

const rules = {
  required: v => !!v || '필수 입력 값입니다.',
  uppercase: v => /^[A-Z0-9]+$/.test(v) || '대문자와 숫자만 입력하세요.'
}

function toUpper(val) {
  restaurantInfo.value.id = val.toUpperCase()
}

function onRestaurantPreview({ menuImgId, menuUrl }) {
  console.log("onRestaurantPreview", menuImgId, menuUrl);

  if (menuImgId) {
    const url = cld.image(menuImgId).format('auto').quality('auto').toURL()
    console.log("url", url);
    window.open(url, '_blank', 'noopener')
  } else if (menuUrl) {
    window.open(menuUrl, '_blank', 'noopener')
  }
}

onMounted(async () => {
  uid.value = userStore.user.uid;

  await selectBlockRestaurant()
  await selectData();

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
            <v-list-item v-for="(menu, i) in appMenu" :key="i" :value="i" @click="menu.action" :prepend-icon="menu.title.icon">
              <v-list-item-title>{{ menu.title.text }}</v-list-item-title>
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
        식권대장 점심
      </v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-data-table :headers="headers" :items="restaurant" no-data-text="조회중입니다." loading-text="조회중입니다."
        hide-default-footer items-per-page="-1" :show-items-per-page="false">
        <template v-slot:item.name="{ item }">
          <v-btn :variant="item.lastDate === getToday() ? 'flat' : 'tonal'"
            :color="blockRestaurant.includes(item.id) ? 'grey-darken-3' : 'primary'" class="px-1"
            @click="choiceMenu(item)"><v-icon>{{ restaurantKind[item.kind] }}</v-icon> {{ item.name }}</v-btn>
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

    <v-dialog v-model="isMenuPopup" max-width="600px">
      <v-card>
        <v-card-title class="d-flex align-center">{{ menuPopupRef.name }}
          <v-icon class="ml-1" size="18px" @click="onClickEditRestaurant()">mdi-pencil</v-icon>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="onRestaurantPreview({menuImgId:menuPopupRef.menuImgId, menuUrl:menuPopupRef.menuUrl});"
            icon="mdi-feature-search-outline" />
        </v-card-title>
        <v-card-text>
          <v-combobox v-model="visit.menu" label="메뉴" :items="menuList(visit.restaurantId)"
            variant="outlined"></v-combobox>
        </v-card-text>
        <v-card-actions>
          <v-btn icon="mdi-cancel" :color="blockRestaurant.includes(visit.restaurantId) ? 'red' : 'black'"
            @click="blockRestaurant.includes(visit.restaurantId) ? removeBlockRestaurant() : addBlockRestaurant()"></v-btn>
          <v-spacer></v-spacer>
          <v-btn @click="saveMenu()" icon="mdi-check-bold"></v-btn>
          <v-btn @click="deleteMenu()" :disabled="!menuPopupRef.isChoice" icon="mdi-delete"></v-btn>
          <v-btn @click="isMenuPopup = false" icon="mdi-close-thick"></v-btn>
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

    <RestaurantPopup v-model="isRestaurantPopup" :is-add="isRestaurantAdd" :restaurant-info="restaurantInfo"
      :restaurant-kind="restaurantKind" :block-list="blockRestaurant" :uid="uid" :cloud-name="cloudName"
      :upload-preset="uploadPreset" @saved="selectRestaurant" @block-changed="(list) => { blockRestaurant = list }"
      @preview="onRestaurantPreview" />

  </v-app>
</template>

<style scoped>
.menu-url-field input {
  white-space: nowrap;
  overflow-x: auto;
}
</style>