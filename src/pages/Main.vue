<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../store/user';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useRouter } from 'vue-router';
import { useCookies } from '@vueuse/integrations/useCookies';
import { database, ref as firebaseRef, get, update } from "../config/firebase";

const userStore = useUserStore();
const router = useRouter();
const cookies = useCookies();

const user = userStore.user;
const userInfo = ref({});
const restaurant = ref([]);
const visitLog = ref([]);
const isMenuPopup = ref(false);
const visit = ref({});
const restaurantTelNo = ref("");

const headers = [
  { title: '식당', align: 'start', key: 'name', value: 'name' },
  { title: '방문일', align: 'center', sortable: false, key: 'lastDate', value: 'lastDate' },
  { title: '전화', align: 'end', sortable: false, key: 'telNo', value: 'telNo' },
];






async function logout() {
  await signOut(auth);
  cookies.remove('authToken');
  userStore.clearUser();
  router.push('/login');
};

async function selectUser() {
  const dbRef = firebaseRef(database, "user/" + auth.currentUser.uid);
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


async function selectRestaurant() {
  const dbRef = firebaseRef(database, "lunch-resv/restaurant");
  await get(dbRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        restaurant.value = snapshot.val();
      }
    })
    .catch(err => {
      //console.error("Error fetching data:", err);
    });


  restaurant.value.forEach(r => {
    const logs = visitLog.value
      .filter(log => log.restaurantId === r.id)
      .sort((a, b) => b.date.localeCompare(a.date)); // 최신 순 정렬

    console.log('logs', r.id, logs);

    const latest = logs[0];
    if (latest) {
      r.lastDate = latest.date;
      r.lastMenu = latest.menu;
    } else {
      r.lastDate = null;
      r.lastMenu = null;
    }
  });

  restaurant.value = restaurant.value.sort((a, b) => {
    if (!a.lastDate && !b.lastDate) return 0;           // 둘 다 null
    if (!a.lastDate) return 1;                          // a가 null이면 뒤로
    if (!b.lastDate) return -1;                         // b가 null이면 앞으로
    return a.lastDate.localeCompare(b.lastDate);        // 문자열 날짜 내림차순
  });

}

async function selectVisitLog() {
  const dbRef = firebaseRef(database, "lunch-resv/visitLog/" + auth.currentUser.uid);
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

function callRestaurant(telNo) {
  //window.location.href = `tel:${this.telNo}`;
  restaurantTelNo.value = telNo;
  this.$refs.telLink.click();
}

function selectMenu(item) {
  visit.value.date = getToday();
  visit.value.restaurantId = item.id;
  isMenuPopup.value = true;

  console.log(visit.value);
}


function menuList(id) {
  const uniqueMenus = [...new Set(
    visitLog.value
      .filter(item => item.restaurantId === id) // GANG15 필터
      .map(item => item.menu)                         // 메뉴만 추출
  )];

  return uniqueMenus;
}

async function saveMenu() {
  console.log("menu", visit.value);

  const data = {
    [visitLog.value.length]: visit.value
  }

  try {
    const dbRef = firebaseRef(database, "lunch-resv/visitLog/" + auth.currentUser.uid);
    await update(dbRef, data); // 데이터를 저장
  } catch (err) {
    console.error("Error saving data:", err);
  }
  
  await selectVisitLog();
  await selectRestaurant();
  isMenuPopup.value = false;
}

onMounted(async () => {
  console.log("auth.currentUser.uid", auth.currentUser.uid);
  await selectUser();
  await selectVisitLog();
  await selectRestaurant();

  console.log('userInfo', userInfo.value);
  console.log('restaurant', restaurant.value);
  console.log('visitLog', visitLog.value);

});

console.log('user', user);
</script>

<template>
  <v-app>
    <v-app-bar color="teal-darken-4">
      <template v-slot:image>
        <v-img gradient="to top right, rgba(19,84,122,.8), rgba(128,208,199,.8)"></v-img>
      </template>
      <template v-slot:append>
        <v-btn icon="mdi-logout" @click="logout()"></v-btn>
      </template>
      <v-app-bar-title><v-icon>mdi-food</v-icon> 식권대장 점심</v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-data-table :headers="headers" :items="restaurant" no-data-text="조회중입니다." loading-text="조회중입니다."
        hide-default-footer items-per-page="-1" :show-items-per-page="false">
        <template v-slot:item.name="{ item }">
          <v-btn :variant="item.lastDate === getToday() ? 'flat' : 'tonal'" color="primary"
            @click="selectMenu(item)"><v-icon>{{ foodImage(item.kind) }}</v-icon> {{ item.name }}</v-btn>
        </template>
        <template v-slot:item.lastDate="{ item }">
          <span>{{ item.lastDate ? formatKoreanDate(item.lastDate) : '' }}</span><br />
          <small>{{ item.lastMenu }}</small>
        </template>

        <template v-slot:item.telNo="{ item }">
          <v-btn class="pa-0" icon="mdi-phone" size="small" @click="callRestaurant(item.telNo)"></v-btn>
        </template>
      </v-data-table>
    </v-main>

    <v-dialog v-model="isMenuPopup" max-width="600px">
      <v-card>
        <v-card-title>메뉴 선택</v-card-title>
        <v-card-text>
          <v-combobox v-model="visit.menu" label="메뉴" :items="menuList(visit.restaurantId)"
            variant="outlined"></v-combobox>

        </v-card-text>
        <v-card-actions>
          <v-btn @click="saveMenu()" icon="mdi-check-bold"></v-btn>
          <!-- <v-btn @click="resvDelete(resvKey)" :disabled="isResvAdd" icon="mdi-delete"></v-btn> -->
          <v-btn @click="isMenuPopup = false" icon="mdi-close-thick"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <a :href="`tel:${restaurantTelNo}`"
      ref="telLink"
      style="display: none"
    ></a>
  </v-app>

</template>
