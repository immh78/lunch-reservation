// main.js
import { createApp } from 'vue';
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

const vuetify = createVuetify({ components, directives });
const pinia = createPinia();
pinia.use(persistedState); 

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
