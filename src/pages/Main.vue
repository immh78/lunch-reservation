<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../store/user';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useRouter } from 'vue-router';
import { useCookies } from '@vueuse/integrations/useCookies';
import { database, ref as firebaseRef, get } from "../config/firebase";

const userStore = useUserStore();
const router = useRouter();
const cookies = useCookies();

const user = userStore.user;
const userInfo = ref({});
const restaurant = ref([]);
const visitLog = ref([]);

const headers = [
  { title: '식당', align: 'start', key: 'name', value: 'name' },
  { title: '방문일', align: 'center', sortable: false, key: 'lastDate', value: 'lastDate' },
  { title: '메뉴', align: 'end', sortable: false, key: 'menu', value: 'menu' },
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
        <v-btn icon="mdi-content-save" @click="saveWorkInfo()"></v-btn>
      </template>
      <v-app-bar-title><v-icon>mdi-food</v-icon> 식권대장 점심</v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-data-table :headers="headers" :items="restaurant" no-data-text="조회중입니다." loading-text="조회중입니다."
        hide-default-footer items-per-page="-1" :show-items-per-page="false">

        <template v-slot:item.telNo="{ item }">
          <a :href="`tel:${item.telNo}`">{{ item.telNo }}</a>
        </template>



      </v-data-table>
      <button @click="logout">로그아웃</button>
    </v-main>
  </v-app>

</template>
