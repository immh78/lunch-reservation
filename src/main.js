// main.js
import { createApp, watch } from 'vue';
import App from './App.vue';
import router from './router';

//firebase
import { auth } from './config/firebase'; // Firebase 초기화
import { onAuthStateChanged } from 'firebase/auth';
import { useUserStore } from './store/user';

// Vuetify
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

//pinia
import { createPinia } from 'pinia';
import persistedState from 'pinia-plugin-persistedstate'; 

const vuetify = createVuetify({ components, directives,
    defaults: {
        global: {
          font: '', // 기본 폰트 해제
        },
      },
      defaultAssets: {
        font: false, // Roboto 자동 불러오기 방지
      },
 });
const pinia = createPinia();
pinia.use(persistedState); 

router.isReady().then(() => {
    watch(
        () => router.currentRoute.value.path,
        (newPath) => {
            const manifest = document.querySelector('link[rel="manifest"]')
            if (!manifest) return

            const pages= [
                'reservation'
            ];

            manifest.href = "";

            for (const page of pages) {
                if (newPath.includes(`/${page}`)) {
                    manifest.href = `/lunch-reservation/manifests/manifest-${page}.json?v=` + Date.now();
                    break;
                }
            }

            if (manifest.href === "") {
                manifest.href = '/lunch-reservation/manifests/manifest.json?v=' + Date.now();
            }

        },
        { immediate: true }
    )
})

const app = createApp(App);
app.use(vuetify).use(router).use(pinia);

onAuthStateChanged(auth, (user) => {
    //console.log("onAuthStateChanged", user);
    const userStore = useUserStore();
    if (user) {
        userStore.setUser({
            email: auth.currentUser.email,
            uid: auth.currentUser.uid
        }); // 로그인 정보 저장
    } else {
        userStore.clearUser();
    }   
    
});

// ✅ mount만 책임
app.mount('#app');
